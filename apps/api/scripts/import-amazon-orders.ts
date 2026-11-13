import { readFile } from "node:fs/promises";

import { AmazonOrderNumber, SupplierOrderInput } from "@amerik/contracts";
import { Database, dieOnDatabaseError, schema } from "@amerik/db";
import { count, sum } from "drizzle-orm";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import { importSupplierOrders } from "../src/supply.ts";

const { supplierOrderLines, supplierOrders } = schema;

/** One line of the backfill's JSONL, `{"date":"November 10, 2026","total":491.11,"order":"114-…","items":[…]}`. */
const AmazonOrder = Schema.fromJsonString(
  Schema.Struct({
    date: Schema.String,
    total: Schema.Number,
    order: AmazonOrderNumber,
    items: Schema.Array(
      Schema.Struct({ asin: Schema.String, title: Schema.String, qty: Schema.Int }),
    ),
  }),
);

const run = Effect.fn("ImportAmazonOrders.run")(function* run(path: string | undefined) {
  if (path === undefined) return yield* Effect.die("usage: import-amazon-orders.ts <orders.jsonl>");

  const text = yield* Effect.promise(() => readFile(path, "utf8"));

  const rows = yield* Effect.forEach(
    text.split("\n").filter((line) => line.trim() !== ""),
    (line) => Schema.decodeUnknownEffect(AmazonOrder)(line),
  );

  // The page failed to list items for a few orders; there is nothing to receive on them.
  const listed = rows.filter((row) => row.items.length > 0);

  const orders = yield* Schema.decodeUnknownEffect(Schema.Array(SupplierOrderInput))(
    listed.map((row) => ({
      number: row.order,
      orderedOn: DateTime.formatIsoDateUtc(DateTime.makeUnsafe(row.date)),
      totalCents: Math.round(row.total * 100),
      items: row.items,
    })),
  );

  yield* importSupplierOrders(orders);

  const db = yield* Database;

  const [[ordersRow], [linesRow]] = yield* Effect.all([
    db
      .select({ orders: count(), withTotal: count(supplierOrders.totalCents) })
      .from(supplierOrders),
    db
      .select({
        lines: count(),
        units: sum(supplierOrderLines.qty).mapWith(Number),
        matched: count(supplierOrderLines.productId),
        costed: count(supplierOrderLines.unitCostCents),
      })
      .from(supplierOrderLines),
  ]).pipe(dieOnDatabaseError);

  yield* Console.log(
    JSON.stringify({
      read: rows.length,
      skippedWithoutItems: rows.length - listed.length,
      ...ordersRow,
      ...linesRow,
    }),
  );
});

const main = Effect.gen(function* main() {
  const database = yield* Layer.build(Database.fromUrl(yield* Config.Redacted("DATABASE_URL")));

  yield* run(process.argv[2]).pipe(Effect.provide(database));
});

// Script entry: loads the JSONL into DATABASE_URL, which is local Postgres, never production.
await Effect.runPromise(main.pipe(Effect.scoped));
