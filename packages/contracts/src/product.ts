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

/** The product doesn't exist, or it's archived and can't be added to an order. */
export class ProductUnavailable extends Schema.TaggedError<ProductUnavailable>()(
  "ProductUnavailable",
  { productId: ProductId },
) {}
