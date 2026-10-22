import * as Schema from "effect/Schema";

import { OrderId, OrderNumber, ProductId, StockMoveId } from "./ids.ts";
import { StockMoveReason, Tugrik } from "./order.ts";

/** What the bottle holds, one of the six identity fields on a product. */
export const ProductForm = Schema.Literals([
  "softgel",
  "capsule",
  "tablet",
  "chewable",
  "gummy",
  "lozenge",
  "powder",
  "liquid",
  "other",
]);

export type ProductForm = typeof ProductForm.Type;

/** A hand count sets stock to `counted`. The first count of an unknown (null) stock is one too. */
export const CountStock = Schema.Struct({
  productId: ProductId,
  counted: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  note: Schema.optional(Schema.String),
});

export type CountStock = typeof CountStock.Type;

/** A shipment arrived: stock goes up by `received`. */
export const ReceiveStock = Schema.Struct({
  productId: ProductId,
  received: Schema.Int.check(Schema.isGreaterThan(0)),
  note: Schema.optional(Schema.String),
});

export type ReceiveStock = typeof ReceiveStock.Type;

/** A new shelf price. Old orders keep the price they were placed at. */
export const SetPrice = Schema.Struct({ productId: ProductId, price: Tugrik });

export type SetPrice = typeof SetPrice.Type;

/** Archive hides a product from the list and new orders; it is never deleted. */
export const ArchiveProduct = Schema.Struct({ productId: ProductId, archived: Schema.Boolean });

export type ArchiveProduct = typeof ArchiveProduct.Type;

/** One stock-log line, with the order's number when a sale or cancel moved it. */
export const StockMove = Schema.Struct({
  id: StockMoveId,
  change: Schema.Int,
  reason: StockMoveReason,
  note: Schema.NullOr(Schema.String),
  actor: Schema.String,
  createdAt: Schema.Date,
  orderId: Schema.NullOr(OrderId),
  orderNumber: Schema.NullOr(OrderNumber),
});

export type StockMove = typeof StockMove.Type;

/** The product page: every photo, the label facts, the copy, and the latest stock log. */
export const ProductDetail = Schema.Struct({
  id: ProductId,
  name: Schema.String,
  brand: Schema.String,
  category: Schema.String,
  potency: Schema.NullOr(Schema.String),
  count: Schema.Int,
  form: ProductForm,
  flavor: Schema.NullOr(Schema.String),
  price: Schema.Int,
  stock: Schema.NullOr(Schema.Int),
  images: Schema.Array(Schema.String),
  description: Schema.NullOr(Schema.String),
  servingSize: Schema.NullOr(Schema.Int),
  servings: Schema.NullOr(Schema.Int),
  archivedAt: Schema.NullOr(Schema.Date),
  /** Bottles sold in the last 30 days, net of cancels and edits. */
  sold30: Schema.Int,
  moves: Schema.Array(StockMove),
});

export type ProductDetail = typeof ProductDetail.Type;

/** A row on the products page. `stock` is null until the first count or receipt. */
export const ProductRow = Schema.Struct({
  id: ProductId,
  name: Schema.String,
  brand: Schema.String,
  count: Schema.Int,
  image: Schema.NullOr(Schema.String),
  price: Schema.Int,
  stock: Schema.NullOr(Schema.Int),
  archivedAt: Schema.NullOr(Schema.Date),
});

export type ProductRow = typeof ProductRow.Type;

/** The product doesn't exist, or it's archived and can't be added to an order. */
export class ProductUnavailable extends Schema.TaggedError<ProductUnavailable>()(
  "ProductUnavailable",
  { productId: ProductId },
) {}
