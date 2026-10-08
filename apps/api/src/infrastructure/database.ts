import { AlchemyContext } from "alchemy/AlchemyContext";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Command from "alchemy/Command";
import * as Output from "alchemy/Output";
import { retain } from "alchemy/RemovalPolicy";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
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

  const origin = {
    database: yield* Config.String("PLANETSCALE_DATABASE"),
    host: yield* Config.String("PLANETSCALE_HOST"),
    password: yield* Config.Redacted("PLANETSCALE_PASSWORD"),
    port: 5432,
    scheme: "postgres",
    user: yield* Config.String("PLANETSCALE_USER"),
  } as const;

  const path = yield* Path.Path;

  // Migrations run on every deploy, before the Worker that needs them.
  const migrations = yield* Command.Exec("Migrations", {
    command: "node src/migrate.ts",
    cwd: yield* path.fromFileUrl(new URL("../../../../packages/db", import.meta.url)),
    env: {
      DATABASE_URL: Redacted.make(
        `postgres://${encodeURIComponent(origin.user)}:${encodeURIComponent(Redacted.value(origin.password))}` +
          `@${origin.host}:${origin.port}/${encodeURIComponent(origin.database)}?sslmode=verify-full`,
      ),
    },
    memo: false,
    timeout: "5 minutes",
  });

  // Hyperdrive needs an uploaded trust root even for publicly issued
  // certificates. PlanetScale's Let's Encrypt chain ends at ISRG Root X1.
  const fs = yield* FileSystem.FileSystem;

  const authority = yield* Cloudflare.MtlsCertificate.MtlsCertificate(
    "DatabaseCertificateAuthority",
    {
      ca: true,
      certificates: yield* fs.readFileString(
        yield* path.fromFileUrl(new URL("../../certificates/isrg-root-x1.pem", import.meta.url)),
      ),
    },
  ).pipe(retain());

  return yield* Cloudflare.Hyperdrive.Connection("Postgres", {
    caching: { disabled: true },
    mtls: { caCertificateId: authority.mtlsCertificateId, sslmode: "verify-full" },
    // Depending on the migration hash keeps the Worker from running ahead of the schema.
    origin: Output.all(Output.asOutput(origin), migrations.hash).pipe(
      Output.map(([resolved]) => resolved),
    ),
  });
}).pipe(Effect.orDie);
