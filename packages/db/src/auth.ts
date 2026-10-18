import { effectPgCodecs } from "drizzle-orm/effect-postgres";
import { drizzle } from "drizzle-orm/pg-proxy";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { Database, databaseFault } from "./database.ts";
import { accounts, sessions, users, verifications } from "./schema.ts";

/** better-auth's tables, keyed by its plural model names (`usePlural: true`). */
export const authTables = { users, sessions, accounts, verifications };

/** `@effect/sql-pg`'s raw result. The statement types it `unknown` because SqlClient is driver-neutral. */
const RawResult = Schema.Struct({ rows: Schema.Array(Schema.Unknown), rowCount: Schema.Number });

/**
 * This request's `Database` as a Promise drizzle, because better-auth's
 * drizzle adapter awaits its queries. Each query runs on the same Effect
 * client and connection, with the same codecs, as drizzle's Effect driver
 * (`drizzle-orm/effect-postgres/session`). A failed query logs like any
 * other and rejects with a bare `DatabaseFault`.
 */
export const promiseDatabase = Effect.gen(function* promiseDatabase() {
  const db = yield* Database;
  const run = Effect.runPromiseWith(yield* Effect.context<never>());

  return drizzle(
    (sql, params, method) => {
      const statement = db.$client.unsafe(sql, params);

      // "all" wants rows as value arrays. Everything else gets object rows
      // carrying `rowCount`, which the adapter reads to count the rows a write
      // without RETURNING touched, as it does on node-postgres.
      const rows: Effect.Effect<Array<unknown>> =
        method === "all"
          ? statement.values.pipe(
              Effect.map((values) => [...values]),
              Effect.catch(databaseFault),
            )
          : statement.raw.pipe(
              Effect.catch(databaseFault),
              Effect.flatMap(Schema.decodeUnknownEffect(RawResult)),
              Effect.orDie,
              Effect.map((result) =>
                Object.assign([...result.rows], { rowCount: result.rowCount }),
              ),
            );

      return run(Effect.map(rows, (all) => ({ rows: all })));
    },
    { codecs: effectPgCodecs },
  );
});
