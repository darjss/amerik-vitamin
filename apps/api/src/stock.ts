import { ProductUnavailable } from "@amerik/contracts";
import type { CountStock } from "@amerik/contracts";
import { Database, moveStock, schema, transaction } from "@amerik/db";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";

const { products } = schema;

/** Sets stock to what mom counted. The stock log keeps the difference and her note. */
export const countStock = Effect.fn("countStock")(function* countStock(
  input: CountStock,
  actor: string,
) {
  const db = yield* Database;

  const [product] = yield* db
    .select({ stock: products.stock })
    .from(products)
    .where(eq(products.id, input.productId))
    .for("update");

  if (product === undefined) return yield* new ProductUnavailable({ productId: input.productId });

  const change = input.counted - (product.stock ?? 0);

  yield* moveStock({
    productId: input.productId,
    change,
    reason: "count",
    note: input.note,
    actor,
  });

  return { stock: input.counted, change };
}, transaction);
