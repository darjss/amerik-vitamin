import * as PgClient from "@effect/sql-pg/PgClient";
import { migrate } from "drizzle-orm/effect-postgres/migrator";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { Database } from "./database.ts";

// Applies ./migrations to DATABASE_URL. The journal table lives in `shop` too,
// so nothing outside that schema is created or read.
const program = Effect.gen(function* applyMigrations() {
  const db = yield* Database;
  yield* migrate(db, {
    migrationsFolder: new URL("../migrations", import.meta.url).pathname,
    migrationsSchema: "shop",
    migrationsTable: "migrations",
  });
});

await Effect.runPromise(
  program.pipe(
    Effect.provide(
      Database.layer.pipe(
        Layer.provide(PgClient.layerConfig({ url: Config.Redacted("DATABASE_URL") })),
      ),
    ),
  ),
);
