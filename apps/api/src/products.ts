import { Database, dieOnDatabaseError, schema } from "@amerik/db";
import { asc, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";

const { brands, products } = schema;

/** Every product, archived ones included, by brand and name. */
export const listProducts = Effect.fn("listProducts")(function* listProducts() {
  const db = yield* Database;

  const rows = yield* db
    .select({
      id: products.id,
      name: products.name,
      brand: brands.name,
      count: products.count,
      images: products.images,
      price: products.price,
      stock: products.stock,
      archivedAt: products.archivedAt,
    })
    .from(products)
    .innerJoin(brands, eq(brands.id, products.brandId))
    .orderBy(asc(brands.name), asc(products.name))
    .pipe(dieOnDatabaseError);

  return rows.map(({ images, ...product }) => ({ ...product, image: images[0] ?? null }));
});
