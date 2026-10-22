import * as PgClient from "@effect/sql-pg/PgClient";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { Database } from "./database.ts";
import { applyMigrations } from "./migrations.ts";

await Effect.runPromise(
  applyMigrations.pipe(
    Effect.provide(
      Database.layer.pipe(
        Layer.provide(PgClient.layerConfig({ url: Config.Redacted("DATABASE_URL") })),
      ),
    ),
  ),
);
