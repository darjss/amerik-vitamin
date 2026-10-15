import * as Schema from "effect/Schema";

import { OrderId, ProductId } from "./ids";

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

/** Whole tugriks. */
export const Tugrik = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

/** Mongolian mobile numbers are 8 digits. The UI strips spaces and the +976 prefix. */
export const Phone = Schema.String.check(Schema.isPattern(/^[0-9]{8}$/u));

/** `unitPrice` overrides the product's price, on manual orders only. That's the discount system. */
export const OrderLineInput = Schema.Struct({
  productId: ProductId,
  quantity: Schema.Int.check(Schema.isGreaterThan(0)),
  unitPrice: Schema.optional(Tugrik),
});

export const PlaceOrder = Schema.Struct({
  phone: Schema.optional(Phone),
  name: Schema.optional(Schema.String),
  address: Schema.optional(Schema.String),
  notes: Schema.optional(Schema.String),
  source: OrderSource,
  terms: PaymentTerms,
  fulfillment: Fulfillment,
  deliveryFee: Tugrik,
  lines: Schema.NonEmptyArray(OrderLineInput),
});

export type PlaceOrder = typeof PlaceOrder.Type;

/** The order's full new line list. Lines left out are removed. */
export const EditOrder = Schema.Struct({
  orderId: OrderId,
  address: Schema.optional(Schema.String),
  notes: Schema.optional(Schema.String),
  deliveryFee: Tugrik,
  lines: Schema.NonEmptyArray(OrderLineInput),
});

export type EditOrder = typeof EditOrder.Type;

/** A negative amount is a refund. `providerRef` is the QPay payment id or the Khaan fingerprint. */
export const RecordPayment = Schema.Struct({
  orderId: OrderId,
  amount: Schema.Int.check(Schema.makeFilter((amount: number) => amount !== 0)),
  method: PaymentMethod,
  providerRef: Schema.optional(Schema.String),
});

export type RecordPayment = typeof RecordPayment.Type;

export class OrderNotFound extends Schema.TaggedError<OrderNotFound>()("OrderNotFound", {
  orderId: OrderId,
}) {}

/** The action isn't allowed from the order's current status. */
export class WrongOrderStatus extends Schema.TaggedError<WrongOrderStatus>()("WrongOrderStatus", {
  orderId: OrderId,
  status: OrderStatus,
}) {}

/**
 * - `duplicate_line`: the same product twice. Change the quantity instead.
 * - `cod_not_allowed`: the bot and the websites are prepay only.
 * - `price_override`: only manual orders set their own line prices.
 */
export class InvalidOrder extends Schema.TaggedError<InvalidOrder>()("InvalidOrder", {
  reason: Schema.Literals(["duplicate_line", "cod_not_allowed", "price_override"]),
}) {}

/** A refund larger than what the order has been paid. */
export class RefundExceedsPaid extends Schema.TaggedError<RefundExceedsPaid>()(
  "RefundExceedsPaid",
  { orderId: OrderId, paid: Tugrik },
) {}

/** The provider transaction is already recorded, for another order or another amount. */
export class PaymentConflict extends Schema.TaggedError<PaymentConflict>()("PaymentConflict", {
  providerRef: Schema.String,
}) {}
