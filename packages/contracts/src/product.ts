import * as Schema from "effect/Schema";

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
