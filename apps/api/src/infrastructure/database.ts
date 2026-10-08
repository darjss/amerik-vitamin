import { AlchemyContext } from "alchemy/AlchemyContext";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";

/** Local Postgres, parsed from DATABASE_URL. infra/alchemy.run.ts starts it in Docker. */
export const localDatabase = Effect.gen(function* parse() {
  const url = new URL(Redacted.value(yield* Config.Redacted("DATABASE_URL")));
  return {
    database: url.pathname.slice(1),
    host: url.hostname,
    password: Redacted.make(decodeURIComponent(url.password)),
    port: Number(url.port),
    scheme: "postgres" as const,
    user: decodeURIComponent(url.username),
  };
});

// The one Postgres database. Production is the existing PlanetScale database
// that vit-store uses; Alchemy never provisions it.
export const Postgres = Effect.gen(function* provision() {
  // Inside the deployed Worker there is no provisioning context or .env, only
  // the binding's identity.
  if (globalThis.__ALCHEMY_RUNTIME__) {
    return yield* Cloudflare.Hyperdrive.Connection.ref("Postgres");
  }
  const { dev } = yield* AlchemyContext;
  if (dev) {
    const origin = yield* localDatabase;
    return yield* Cloudflare.Hyperdrive.Connection("Postgres", {
      caching: { disabled: true },
      dev: { ...origin, sslmode: "disable" },
      origin,
    });
  }
  return yield* Cloudflare.Hyperdrive.Connection("Postgres", {
    caching: { disabled: true },
    origin: {
      database: yield* Config.String("PLANETSCALE_DATABASE"),
      host: yield* Config.String("PLANETSCALE_HOST"),
      password: yield* Config.Redacted("PLANETSCALE_PASSWORD"),
      scheme: "postgres",
      user: yield* Config.String("PLANETSCALE_USER"),
    },
  });
}).pipe(Effect.orDie);
