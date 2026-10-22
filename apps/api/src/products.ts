import { BrandId, DuplicateProduct, newId, ProductId, ProductUnavailable } from "@amerik/contracts";
import type { ArchiveProduct, NewProduct, SetPrice } from "@amerik/contracts";
import { Database, dieOnDatabaseError, moveStock, schema, transaction } from "@amerik/db";
import { and, asc, desc, eq, gte, inArray, isNull, or, sum } from "drizzle-orm";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

const { brands, categories, orders, products, stockMoves } = schema;

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

/** The brands and categories the new-product form offers. */
export const catalogOptions = Effect.fn("catalogOptions")(function* catalogOptions() {
  const db = yield* Database;

  const [brandRows, categoryRows] = yield* Effect.all([
    db.select({ name: brands.name }).from(brands).orderBy(asc(brands.name)),
    db
      .select({ slug: categories.slug, name: categories.name })
      .from(categories)
      .orderBy(asc(categories.position)),
  ]).pipe(dieOnDatabaseError);

  return { brands: brandRows.map((brand) => brand.name), categories: categoryRows };
});

/** The shop's product with this ASIN, if it has one. */
export const existingProduct = Effect.fn("existingProduct")(function* existingProduct(
  asin: string | null,
) {
  if (asin === null) return null;

  const db = yield* Database;

  const [row] = yield* db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.asin, asin))
    .limit(1)
    .pipe(dieOnDatabaseError);

  return row?.id ?? null;
});

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-|-$/gu, "");

/** A nullable identity field matches only the same value, null included (products_identity). */
const same = (column: Parameters<typeof eq>[0], value: string | null) =>
  value === null ? isNull(column) : eq(column, value);

/**
 * Adds a confirmed product. A new brand name creates the brand. Stock she
 * enters arrives as a receipt in the stock log; none leaves it uncounted.
 */
export const createProduct = Effect.fn("createProduct")(function* createProduct(
  input: NewProduct,
  actor: string,
) {
  const db = yield* Database;
  const now = DateTime.toDateUtc(yield* DateTime.now);

  yield* db
    .insert(brands)
    .values({
      id: yield* newId(BrandId),
      name: input.brand,
      slug: slugify(input.brand),
      createdAt: now,
    })
    .onConflictDoNothing();

  // "Now Foods" and "NOW Foods" share a slug: either spelling reuses the brand.
  const [[brand], [category]] = yield* Effect.all([
    db
      .select({ id: brands.id })
      .from(brands)
      .where(or(eq(brands.name, input.brand), eq(brands.slug, slugify(input.brand))))
      .limit(1),
    db.select({ id: categories.id }).from(categories).where(eq(categories.slug, input.category)),
  ]);

  if (brand === undefined)
    return yield* Effect.die(`createProduct: brand ${input.brand} not saved`);

  if (category === undefined)
    return yield* Effect.die(`createProduct: no category ${input.category}`);

  const identity = and(
    eq(products.brandId, brand.id),
    eq(products.line, input.line),
    same(products.potency, input.potency),
    eq(products.count, input.count),
    eq(products.form, input.form),
    same(products.flavor, input.flavor),
  );

  const [existing] = yield* db
    .select({ id: products.id })
    .from(products)
    .where(input.asin === null ? identity : or(identity, eq(products.asin, input.asin)))
    .limit(1);

  if (existing !== undefined) return yield* new DuplicateProduct({ productId: existing.id });

  const id = yield* newId(ProductId);
  const slug = slugify(`${input.brand} ${input.name}`);

  const [taken] = yield* db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.slug, slug))
    .limit(1);

  yield* db.insert(products).values({
    id,
    brandId: brand.id,
    categoryId: category.id,
    line: input.line,
    potency: input.potency,
    count: input.count,
    form: input.form,
    flavor: input.flavor,
    name: input.name,
    // Two products can share a display name; the id's tail tells their pages apart.
    slug: taken === undefined ? slug : `${slug}-${id.slice(-6)}`,
    price: input.price,
    asin: input.asin,
    servingSize: input.servingSize,
    servings: input.servings,
    dailyUnits: input.dailyUnits,
    images: [...input.images],
    description: input.description,
    createdAt: now,
  });

  if (input.stock > 0) {
    yield* moveStock({
      productId: id,
      change: input.stock,
      reason: "receipt",
      note: "Шинэ бараа",
      actor,
    });
  }

  return id;
}, transaction);

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
