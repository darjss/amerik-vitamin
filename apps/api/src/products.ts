import { Database, dieOnDatabaseError, schema } from "@amerik/db";
import { asc } from "drizzle-orm";
import * as Effect from "effect/Effect";

const { products } = schema;

/** Every product, archived ones included, by name. */
export const listProducts = Effect.fn("listProducts")(function* listProducts() {
  const db = yield* Database;

  return yield* db
    .select({
      id: products.id,
      name: products.name,
      price: products.price,
      stock: products.stock,
      archivedAt: products.archivedAt,
    })
    .from(products)
    .orderBy(asc(products.name))
    .pipe(dieOnDatabaseError);
});
