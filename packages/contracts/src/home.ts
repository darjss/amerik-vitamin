import * as Schema from "effect/Schema";

import { ProductId } from "./ids.ts";

/** At or below this many bottles, a product shows as running out. */
export const LOW_STOCK = 3;

/** Stock is null until the first count or receipt. */
export const stockLevel = (stock: number | null) => {
  if (stock === null) return "unknown";

  if (stock <= 0) return "out";

  return stock <= LOW_STOCK ? "low" : "ok";
};

export type StockLevel = ReturnType<typeof stockLevel>;

const ProductCard = Schema.Struct({
  productId: ProductId,
  name: Schema.String,
  brand: Schema.String,
  count: Schema.Int,
  image: Schema.NullOr(Schema.String),
});

/**
 * Mom's home screen. Every number is one she acts on (apps/web/PRODUCT.md):
 * money in since midnight in Ulaanbaatar, COD still to collect, parcels to
 * pack and what to pull off the shelf for them, and stock running out.
 */
export const Home = Schema.Struct({
  paidToday: Schema.Int,
  codToCollect: Schema.Int,
  codOrders: Schema.Int,
  toShip: Schema.Int,
  toShipPieces: Schema.Int,
  awaitingPayment: Schema.Int,
  shelf: Schema.Array(Schema.Struct({ ...ProductCard.fields, quantity: Schema.Int })),
  lowStock: Schema.Array(Schema.Struct({ ...ProductCard.fields, stock: Schema.Int })),
});

export type Home = typeof Home.Type;
