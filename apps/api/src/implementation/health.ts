import { DatabaseUnavailable } from "@amerik/contracts";
import { Database } from "@amerik/db";
import { sql } from "drizzle-orm";
import * as Effect from "effect/Effect";

/** One round trip through Hyperdrive to Postgres. Connection failures arrive as defects, so catch the whole cause. */
export const pingDatabase = Effect.flatMap(Database, (db) => db.execute(sql`SELECT 1`)).pipe(
  Effect.catchCause(() => Effect.fail(new DatabaseUnavailable())),
);
