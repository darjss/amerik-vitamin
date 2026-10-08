import { existsSync } from "node:fs";

import * as Alchemy from "alchemy";
import { AlchemyContext } from "alchemy/AlchemyContext";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Docker from "alchemy/Docker";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

import ApiWorkerLive from "../apps/api/src/index";
import { deployStage } from "../apps/api/src/infrastructure/stage";
import { localDatabase } from "../apps/api/src/infrastructure/database";
import { ApiWorker } from "../apps/api/src/worker";

const envFile = new URL("../.env", import.meta.url);
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const webRoot = new URL("../apps/web", import.meta.url).pathname;

const postgresPassword = (password: Redacted.Redacted<string>) => ({
  POSTGRES_PASSWORD: Redacted.value(password),
});

// Local dev only. Production Postgres is the existing PlanetScale database.
const localPostgres = Effect.gen(function* start() {
  const origin = yield* localDatabase;
  const data = yield* Docker.Volume("PostgresData", {});
  yield* Docker.Container("LocalPostgres", {
    environment: {
      POSTGRES_DB: origin.database,
      POSTGRES_USER: origin.user,
      ...postgresPassword(origin.password),
    },
    healthcheck: {
      cmd: `pg_isready -U ${origin.user} -d ${origin.database}`,
      interval: "1 second",
      retries: 60,
      timeout: "2 seconds",
    },
    image: "postgres:17",
    ports: [{ external: `127.0.0.1:${origin.port}`, internal: 5432 }],
    start: true,
    volumes: [{ containerPath: "/var/lib/postgresql/data", hostPath: data.name }],
  });
});

export default Alchemy.Stack(
  "amerik-vitamin",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), Docker.providers()),
    // Docker containers belong to one machine, so dev keeps its state local.
    state: Layer.unwrap(
      AlchemyContext.pipe(
        Effect.map(({ dev }) => (dev ? Alchemy.localState() : Cloudflare.state())),
      ),
    ),
  },
  Effect.gen(function* provision() {
    yield* deployStage;
    if ((yield* AlchemyContext).dev) {
      yield* localPostgres;
    }
    const api = yield* ApiWorker;
    const web = yield* Cloudflare.Website.Vite("Web", {
      compatibility: {
        date: "2026-09-08",
        flags: ["nodejs_compat"],
      },
      dev: { port: 3001 },
      env: {
        API: api,
      },
      rootDir: webRoot,
    });

    return {
      apiUrl: api.url.as<string>(),
      webUrl: web.url.as<string>(),
    };
  }).pipe(Effect.provide(ApiWorkerLive)),
);
