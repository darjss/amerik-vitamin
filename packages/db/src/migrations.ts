import { migrate } from "drizzle-orm/effect-postgres/migrator";
import * as Effect from "effect/Effect";

import { Database } from "./database.ts";

/**
 * Applies ./migrations. The journal table lives in `shop` too, so nothing
 * outside that schema is created or read. A failed migration is a defect:
 * every caller is a deploy step, a script or a test setup.
 */
export const applyMigrations = Effect.gen(function* applyMigrations() {
  const db = yield* Database;

  yield* migrate(db, {
    migrationsFolder: new URL("../migrations", import.meta.url).pathname,
    migrationsSchema: "shop",
    migrationsTable: "migrations",
  }).pipe(Effect.orDie);
});
