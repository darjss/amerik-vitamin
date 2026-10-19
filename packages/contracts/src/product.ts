import * as Schema from "effect/Schema";

import { ProductId } from "./ids.ts";

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

/** The product doesn't exist, or it's archived and can't be added to an order. */
export class ProductUnavailable extends Schema.TaggedError<ProductUnavailable>()(
  "ProductUnavailable",
  { productId: ProductId },
) {}
