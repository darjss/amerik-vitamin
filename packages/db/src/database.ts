import * as PgClient from "@effect/sql-pg/PgClient";
import { sql } from "drizzle-orm";
import { EffectDrizzleQueryError } from "drizzle-orm/effect-core";
import * as EffectPg from "drizzle-orm/effect-postgres";
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Redacted from "effect/Redacted";
import { SqlError } from "effect/sql/SqlError";

const makeDb = EffectPg.makeWithDefaults();

/** Drizzle over Postgres as native Effects. Transactions go through `db.$client.withTransaction`. */
export class Database extends Context.Service<Database, Effect.Success<typeof makeDb>>()(
  "amerik/Database",
) {
  static readonly layer = Layer.effect(Database, makeDb);

  static readonly fromUrl = (url: Redacted.Redacted<string>) =>
    Database.layer.pipe(Layer.provide(PgClient.layer({ url })));
}

/**
 * A failed query as a defect with no SQL text and no bound values.
 * drizzle's `EffectDrizzleQueryError.message` carries every bound param
 * (drizzle #6471), and the RPC edge logs every defect it hides.
 */
export class DatabaseFault extends Data.TaggedError("DatabaseFault") {}

type DatabaseError = EffectDrizzleQueryError | SqlError;

/** Logs the failure's tag and its SQL with placeholders only, then dies with a `DatabaseFault`. */
export const databaseFault = (error: DatabaseError) =>
  Effect.logError("database error", {
    error: error._tag,
    query: error instanceof EffectDrizzleQueryError ? error.query : undefined,
  }).pipe(Effect.andThen(Effect.die(new DatabaseFault())));

/** Database failures are infrastructure faults, never outcomes a caller can act on. */
export const dieOnDatabaseError = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.catchIf(
      (error: E): error is Extract<E, DatabaseError> =>
        error instanceof EffectDrizzleQueryError || error instanceof SqlError,
      databaseFault,
    ),
  );

/** Runs `effect` as one transaction. Database failures inside it die as above. */
export const transaction = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.flatMap(Database, (db) => db.$client.withTransaction(effect)).pipe(dieOnDatabaseError);

/** One round trip to Postgres. */
export const ping = Effect.flatMap(Database, (db) => db.execute(sql`SELECT 1`)).pipe(
  dieOnDatabaseError,
);
