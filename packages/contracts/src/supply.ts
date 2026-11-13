import * as Schema from "effect/Schema";

import { AmazonOrderNumber, ProductId } from "./ids.ts";

/** A calendar day, `2026-11-08`. */
export const Day = Schema.String.check(Schema.isPattern(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u));

/**
 * One Amazon order as the backfill or a scraper read it. `totalCents` is null
 * when the page showed no total.
 */
export const SupplierOrderInput = Schema.Struct({
  number: AmazonOrderNumber,
  orderedOn: Day,
  totalCents: Schema.NullOr(Schema.Int),
  items: Schema.NonEmptyArray(
    Schema.Struct({
      asin: Schema.NonEmptyString,
      title: Schema.String,
      qty: Schema.Int.check(Schema.isGreaterThan(0)),
    }),
  ),
});

export type SupplierOrderInput = typeof SupplierOrderInput.Type;

/** `arrived` means nothing is open: every unit came or was marked not coming. */
export const BatchStatus = Schema.Literals(["ordered", "partly_arrived", "arrived"]);

export type BatchStatus = typeof BatchStatus.Type;

/** The shop's product a supplier order line is matched to, as the arrival screens show it. */
export const ShopProduct = Schema.Struct({
  id: ProductId,
  name: Schema.String,
  nameMn: Schema.String,
  brand: Schema.String,
  count: Schema.Int,
  image: Schema.NullOr(Schema.String),
  price: Schema.Int,
});

export type ShopProduct = typeof ShopProduct.Type;

/**
 * Supplier orders with no gap of more than 2 days between them. Units are
 * bottles. `photos` are its matched products that have a photo, in order.
 */
export const Batch = Schema.Struct({
  from: Day,
  to: Day,
  orders: Schema.Int,
  products: Schema.Int,
  ordered: Schema.Int,
  received: Schema.Int,
  open: Schema.Int,
  status: BatchStatus,
  photos: Schema.Array(ShopProduct),
});

export type Batch = typeof Batch.Type;

/**
 * One product on a batch. `product` is null while the shop has no product with
 * the ASIN, so the UI can offer to add it from `title` and `asin`.
 */
export const BatchProduct = Schema.Struct({
  product: Schema.NullOr(ShopProduct),
  asin: Schema.String,
  title: Schema.String,
  ordered: Schema.Int,
  /** Units still open: ordered, not received, not marked not coming. */
  expected: Schema.Int,
  received: Schema.Int,
  /** Amazon's price per bottle on the latest order that shows one. */
  unitCostCents: Schema.NullOr(Schema.Int),
  /** `priceFromAmazon` of the unit cost, null when the cost is unknown. */
  suggestedPrice: Schema.NullOr(Schema.Int),
});

export type BatchProduct = typeof BatchProduct.Type;

export const BatchDetail = Schema.Struct({
  from: Day,
  to: Day,
  products: Schema.Array(BatchProduct),
});

/** `batch` is the batch's first day, its `from`. */
export const ReceiveBatch = Schema.Struct({
  productId: ProductId,
  batch: Day,
  received: Schema.Int.check(Schema.isGreaterThan(0)),
});

export type ReceiveBatch = typeof ReceiveBatch.Type;

export const CloseBatch = Schema.Struct({ productId: ProductId, batch: Day });

export type CloseBatch = typeof CloseBatch.Type;

/** No batch starts on that day, often because a newer import merged it into another. */
export class BatchNotFound extends Schema.TaggedError<BatchNotFound>()("BatchNotFound", {
  batch: Day,
}) {}

/** The product has no open units in the batch, or in older ones for a receipt. */
export class NothingOpen extends Schema.TaggedError<NothingOpen>()("NothingOpen", {
  productId: ProductId,
}) {}
