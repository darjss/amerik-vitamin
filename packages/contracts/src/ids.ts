import * as Schema from "effect/Schema";
import * as Model from "effect/schema/Model";

/**
 * A UUIDv7 branded per table, so a `ProductId` never passes where an
 * `OrderId` is wanted. The brand exists only in types: at runtime every id is
 * the same shape. A struct field of this schema generates its id when
 * `makeEffect` gets none, with the time from Effect's `Clock`.
 */
const uuidV7 = <const Brand extends string>(brand: Parameters<typeof Schema.brand<Brand>>[0]) =>
  Model.UuidV7WithGenerate(Schema.String.check(Schema.isUUID(7)).pipe(Schema.brand<Brand>(brand)));

export const ProductId = uuidV7("ProductId");

export type ProductId = typeof ProductId.Type;

export const BrandId = uuidV7("BrandId");

export type BrandId = typeof BrandId.Type;

export const CategoryId = uuidV7("CategoryId");

export type CategoryId = typeof CategoryId.Type;

export const CustomerId = uuidV7("CustomerId");

export type CustomerId = typeof CustomerId.Type;

export const OrderId = uuidV7("OrderId");

export type OrderId = typeof OrderId.Type;

export const PaymentId = uuidV7("PaymentId");

export type PaymentId = typeof PaymentId.Type;

export const StockMoveId = uuidV7("StockMoveId");

export type StockMoveId = typeof StockMoveId.Type;

export const OrderEventId = uuidV7("OrderEventId");

export type OrderEventId = typeof OrderEventId.Type;

/** The digits a person says for an order, `#10234`. Postgres assigns them. */
export const OrderNumber = Schema.Int.check(Schema.isGreaterThan(0)).pipe(
  Schema.brand("OrderNumber"),
);

export type OrderNumber = typeof OrderNumber.Type;
