import * as Schema from "effect/Schema";

import { OrderId, OrderNumber, ProductId, StockMoveId } from "./ids.ts";
import { StockMoveReason, Tugrik } from "./order.ts";

/**
 * Where production product photos are served (apps/api/infra/images.ts). No
 * "v2" in it, so the URLs stored in `products.images` survive the cutover.
 */
export const IMAGE_HOST = "img.amerikvitamin.mn";

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

/** A product with the same identity (brand, line, potency, count, form, flavor) or ASIN exists. */
export class DuplicateProduct extends Schema.TaggedError<DuplicateProduct>()("DuplicateProduct", {
  productId: ProductId,
}) {}

/** One drafting run: the Cloudflare Workflow instance that reads the source. */
export const DraftId = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100)).pipe(
  Schema.brand("DraftId"),
);

export type DraftId = typeof DraftId.Type;

export class DraftNotFound extends Schema.TaggedError<DraftNotFound>()("DraftNotFound", {
  draftId: DraftId,
}) {}

/** The brand and category lists the new-product form picks from. */
export const CatalogOptions = Schema.Struct({
  brands: Schema.Array(Schema.String),
  categories: Schema.Array(Schema.Struct({ slug: Schema.String, name: Schema.String })),
});

export type CatalogOptions = typeof CatalogOptions.Type;

/** A bottle photo, downscaled on the phone to a JPEG, as base64. About 1600px on the long side. */
const PhotoJpeg = Schema.String.check(Schema.isMinLength(100), Schema.isMaxLength(4_000_000));

export const AmazonSource = Schema.TaggedStruct("amazon", {
  url: Schema.String.check(Schema.isMaxLength(2000)),
});

export const PhotoSource = Schema.TaggedStruct("photo", { jpeg: PhotoJpeg });

/** What the AI reads a new product from: an Amazon link, or a photo of the bottle. */
export const DraftSource = Schema.Union([AmazonSource, PhotoSource]);

export type DraftSource = typeof DraftSource.Type;

/** Every field of the new-product form. The AI fills it; she checks it and adds the price. */
const ProductFields = {
  brand: Schema.String,
  category: Schema.String,
  line: Schema.String,
  potency: Schema.NullOr(Schema.String),
  count: Schema.Int,
  form: ProductForm,
  flavor: Schema.NullOr(Schema.String),
  name: Schema.String,
  servingSize: Schema.NullOr(Schema.Int),
  servings: Schema.NullOr(Schema.Int),
  dailyUnits: Schema.NullOr(Schema.Int),
  description: Schema.String,
  images: Schema.Array(Schema.String),
  asin: Schema.NullOr(Schema.String),
};

/** The AI's draft: the form fields, plus what she needs to judge it. */
export const ProductDraft = Schema.Struct({
  ...ProductFields,
  amazonUrl: Schema.NullOr(Schema.String),
  amazonTitle: Schema.NullOr(Schema.String),
  /** Amazon's price in US cents, a hint for her own price. */
  amazonCents: Schema.NullOr(Schema.Int),
  /** Amazon had no listing for her photo, so the draft is read off the photo alone. */
  photoOnly: Schema.Boolean,
  /** Health-claim words the description still has after one rewrite. */
  bannedWords: Schema.Array(Schema.String),
  /** The writer's own doubt for her, in Mongolian, e.g. a count that disagrees. */
  note: Schema.String,
});

export type ProductDraft = typeof ProductDraft.Type;

/**
 * The shelf price for an Amazon price: vit-store's fitted line (4,587₮ per
 * dollar plus 16,929₮), kept between 40,000₮ and 500,000₮, rounded to
 * 5,000₮, then a flat 5,000₮ on top (COMMERCE-RULES). A suggestion; she sets the price.
 */
export const priceFromAmazon = (cents: number) => {
  const raw = 4587 * (cents / 100) + 16_929;
  const bounded = Math.min(500_000, Math.max(40_000, raw));

  return Math.round(bounded / 5000) * 5000 + 5000;
};

/** Where a drafting run is. `existing` is set when the found product is already in the shop. */
export const DraftState = Schema.Union([
  Schema.TaggedStruct("running", {}),
  Schema.TaggedStruct("ready", { draft: ProductDraft, existing: Schema.NullOr(ProductId) }),
  Schema.TaggedStruct("failed", { reason: Schema.Literals(["not_a_product_page", "failed"]) }),
]);

export type DraftState = typeof DraftState.Type;

const Trimmed = Schema.String.check(Schema.isTrimmed(), Schema.isMinLength(1));

/** The confirmed form. A new brand name creates the brand. */
export const NewProduct = Schema.Struct({
  ...ProductFields,
  brand: Trimmed,
  line: Trimmed,
  name: Trimmed,
  count: Schema.Int.check(Schema.isGreaterThan(0)),
  description: Schema.NullOr(Schema.String),
  price: Tugrik.check(Schema.isGreaterThan(0)),
  stock: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

export type NewProduct = typeof NewProduct.Type;
