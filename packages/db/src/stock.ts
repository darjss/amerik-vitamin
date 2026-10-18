import { newId, StockMoveId } from "@amerik/contracts";
import type { OrderId, ProductId, StockMoveReason } from "@amerik/contracts";
import { eq, sql } from "drizzle-orm";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { Database } from "./database.ts";
import { notify } from "./outbox.ts";
import { products, stockMoves } from "./schema.ts";

/** A count or a receipt gives an unknown (null) stock its first number. A sale leaves it null. */
const STARTS_STOCK = new Set<StockMoveReason>(["count", "receipt"]);

/**
 * The one function that changes `products.stock`, with its stock-log line.
 * Call it inside the caller's transaction. Returns the product's new stock
 * (null while unknown, below 0 when oversold) and its current cost.
 */
export const moveStock = Effect.fn("moveStock")(function* moveStock(move: {
  readonly productId: ProductId;
  readonly change: number;
  readonly reason: StockMoveReason;
  readonly orderId?: OrderId;
  readonly note?: string;
  readonly actor: string;
}) {
  const db = yield* Database;

  const stock = STARTS_STOCK.has(move.reason)
    ? sql`coalesce(${products.stock}, 0) + ${move.change}`
    : sql`${products.stock} + ${move.change}`;

  const [product] = yield* db
    .update(products)
    .set({ stock })
    .where(eq(products.id, move.productId))
    .returning({ stock: products.stock, cost: products.cost, name: products.name });

  if (product === undefined) return yield* Effect.die(`moveStock: no product ${move.productId}`);

  // Stock may go negative (COMMERCE-RULES): the order goes through and mom gets a ping to recount.
  if (move.change < 0 && product.stock !== null && product.stock < 0) {
    yield* notify(
      "oversold",
      `Үлдэгдэл хасах руу орлоо: ${product.name}, ${product.stock} ширхэг. Илүү зарсан эсвэл тоо буруу, тоолж шалгана уу.`,
    );
  }

  yield* db.insert(stockMoves).values({
    ...move,
    id: yield* newId(StockMoveId),
    createdAt: DateTime.toDateUtc(yield* DateTime.now),
  });

  return product;
});
