import * as PgClient from "@effect/sql-pg/PgClient";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

import { Database } from "./database.ts";
import { applyMigrations } from "./migrations.ts";

/**
 * A fresh, migrated Postgres database per layer build, created on the server
 * behind DATABASE_URL (local Docker Postgres, never production) and dropped
 * when the layer's scope closes.
 */
export const testDatabase = Layer.unwrap(
  Effect.gen(function* makeTestDatabase() {
    const url = new URL(Redacted.value(yield* Config.Redacted("DATABASE_URL")));
    const name = `amerik_test_${crypto.randomUUID().replaceAll("-", "")}`;

    const admin = yield* Layer.build(PgClient.layer({ url: Redacted.make(url.href) })).pipe(
      Effect.map(Context.get(PgClient.PgClient)),
    );

    yield* Effect.acquireRelease(admin.unsafe(`CREATE DATABASE "${name}"`), () =>
      admin.unsafe(`DROP DATABASE "${name}" WITH (FORCE)`).pipe(Effect.orDie),
    );

    url.pathname = `/${name}`;

    return Layer.effectDiscard(applyMigrations).pipe(
      Layer.provideMerge(Database.fromUrl(Redacted.make(url.href))),
    );
  }).pipe(Effect.orDie),
);
