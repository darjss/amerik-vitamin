import { ProductUnavailable } from "@amerik/contracts";
import type { ArchiveProduct, ProductId, SetPrice } from "@amerik/contracts";
import { Database, dieOnDatabaseError, schema } from "@amerik/db";
import { and, asc, desc, eq, gte, inArray, sum } from "drizzle-orm";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

const { brands, categories, orders, products, stockMoves } = schema;

/** The photo the dashboard shows: the first one, or none. */
export const firstImage = (images: ReadonlyArray<string>) => images[0] ?? null;

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

  return rows.map(({ images, ...product }) => ({ ...product, image: firstImage(images) }));
});

/** The latest stock-log lines on the product page. Older ones stay in the table. */
const MOVES_SHOWN = 30;

/** One product with its stock log and what sold in the last 30 days. */
export const getProduct = Effect.fn("getProduct")(function* getProduct(productId: ProductId) {
  const db = yield* Database;

  const [product] = yield* db
    .select({
      id: products.id,
      name: products.name,
      brand: brands.name,
      category: categories.name,
      potency: products.potency,
      count: products.count,
      form: products.form,
      flavor: products.flavor,
      price: products.price,
      stock: products.stock,
      images: products.images,
      description: products.description,
      servingSize: products.servingSize,
      servings: products.servings,
      archivedAt: products.archivedAt,
    })
    .from(products)
    .innerJoin(brands, eq(brands.id, products.brandId))
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(eq(products.id, productId))
    .pipe(dieOnDatabaseError);

  if (product === undefined) return yield* new ProductUnavailable({ productId });

  const moves = yield* db
    .select({
      id: stockMoves.id,
      change: stockMoves.change,
      reason: stockMoves.reason,
      note: stockMoves.note,
      actor: stockMoves.actor,
      createdAt: stockMoves.createdAt,
      orderId: stockMoves.orderId,
      orderNumber: orders.number,
    })
    .from(stockMoves)
    .leftJoin(orders, eq(orders.id, stockMoves.orderId))
    .where(eq(stockMoves.productId, productId))
    .orderBy(desc(stockMoves.createdAt))
    .limit(MOVES_SHOWN)
    .pipe(dieOnDatabaseError);

  const since = DateTime.toDateUtc(DateTime.subtract(yield* DateTime.now, { days: 30 }));

  // Sales take stock down; a cancel or an edit that removes a bottle gives it back.
  const [sold] = yield* db
    .select({ change: sum(stockMoves.change).mapWith(Number) })
    .from(stockMoves)
    .where(
      and(
        eq(stockMoves.productId, productId),
        inArray(stockMoves.reason, ["sale", "cancel", "edit"]),
        gte(stockMoves.createdAt, since),
      ),
    )
    .pipe(dieOnDatabaseError);

  // No moves sums to null.
  return { ...product, sold30: -(sold?.change ?? 0), moves };
});

export const setPrice = Effect.fn("setPrice")(function* setPrice(input: SetPrice) {
  const db = yield* Database;

  const updated = yield* db
    .update(products)
    .set({ price: input.price })
    .where(eq(products.id, input.productId))
    .returning({ id: products.id })
    .pipe(dieOnDatabaseError);

  if (updated.length === 0) return yield* new ProductUnavailable({ productId: input.productId });
});

export const archiveProduct = Effect.fn("archiveProduct")(function* archiveProduct(
  input: ArchiveProduct,
) {
  const db = yield* Database;
  const archivedAt = input.archived ? DateTime.toDateUtc(yield* DateTime.now) : null;

  const updated = yield* db
    .update(products)
    .set({ archivedAt })
    .where(eq(products.id, input.productId))
    .returning({ id: products.id })
    .pipe(dieOnDatabaseError);

  if (updated.length === 0) return yield* new ProductUnavailable({ productId: input.productId });
});
