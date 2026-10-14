import * as Schema from "effect/Schema";
import { typeid } from "typeid-js";

/**
 * A TypeID (`prd_01h455vb4pex5vsknk084sn02q`) branded per table, so a
 * `ProductId` never passes where an `OrderId` is wanted. `.new()` mints a new
 * one; decoding checks the prefix and the base32 suffix.
 */
const typeId = <const Brand extends string>(
  prefix: string,
  brand: Parameters<typeof Schema.brand<Brand>>[0],
) => {
  const schema = Schema.String.check(
    Schema.isPattern(new RegExp(`^${prefix}_[0-7][0-9a-hjkmnp-tv-z]{25}$`)),
  ).pipe(Schema.brand<Brand>(brand));

  return Object.assign(schema, { new: () => schema.make(typeid(prefix).toString()) });
};

export const ProductId = typeId("prd", "ProductId");

export type ProductId = typeof ProductId.Type;

export const BrandId = typeId("brd", "BrandId");

export type BrandId = typeof BrandId.Type;

export const CategoryId = typeId("cat", "CategoryId");

export type CategoryId = typeof CategoryId.Type;

export const CustomerId = typeId("cus", "CustomerId");

export type CustomerId = typeof CustomerId.Type;

export const OrderId = typeId("ord", "OrderId");

export type OrderId = typeof OrderId.Type;

export const PaymentId = typeId("pay", "PaymentId");

export type PaymentId = typeof PaymentId.Type;

export const StockMoveId = typeId("mov", "StockMoveId");

export type StockMoveId = typeof StockMoveId.Type;

export const OrderEventId = typeId("evt", "OrderEventId");

export type OrderEventId = typeof OrderEventId.Type;

/** The digits a person says for an order, `#10234`. Postgres assigns them. */
export const OrderNumber = Schema.Int.check(Schema.isGreaterThan(0)).pipe(
  Schema.brand("OrderNumber"),
);

export type OrderNumber = typeof OrderNumber.Type;
