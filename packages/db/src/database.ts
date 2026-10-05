import * as PgClient from "@effect/sql-pg/PgClient";
import * as EffectPg from "drizzle-orm/effect-postgres";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Redacted from "effect/Redacted";

const makeDb = EffectPg.makeWithDefaults();

/** Drizzle over Postgres as native Effects. Transactions go through `db.$client.withTransaction`. */
export class Database extends Context.Service<Database, Effect.Success<typeof makeDb>>()(
  "amerik/Database",
) {
  static readonly layer = Layer.effect(Database, makeDb);

  static readonly fromUrl = (url: Redacted.Redacted<string>) =>
    Database.layer.pipe(Layer.provide(PgClient.layer({ url })));
}
