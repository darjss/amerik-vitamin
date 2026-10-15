import * as Schema from "effect/Schema";

/** docs/COMMERCE-RULES.md: status only moves forward, cancel only from new or paid. */
export const OrderStatus = Schema.Literals(["new", "paid", "shipped", "delivered", "cancelled"]);

export type OrderStatus = typeof OrderStatus.Type;

export const PaymentTerms = Schema.Literals(["prepay", "cod"]);

export type PaymentTerms = typeof PaymentTerms.Type;

export const OrderSource = Schema.Literals([
  "messenger_bot",
  "messenger_human",
  "web",
  "brand_site",
  "phone",
  "walk_in",
  "notebook",
]);

export type OrderSource = typeof OrderSource.Type;

export const Fulfillment = Schema.Literals(["courier", "pickup", "in_store"]);

export type Fulfillment = typeof Fulfillment.Type;

export const PaymentMethod = Schema.Literals(["qpay", "transfer", "cash"]);

export type PaymentMethod = typeof PaymentMethod.Type;

export const OrderEventType = Schema.Literals([
  "placed",
  "edited",
  "payment_recorded",
  "paid",
  "shipped",
  "delivered",
  "cancelled",
]);

export type OrderEventType = typeof OrderEventType.Type;

export const StockMoveReason = Schema.Literals(["sale", "cancel", "edit", "receipt", "count"]);

export type StockMoveReason = typeof StockMoveReason.Type;
