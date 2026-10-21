import * as Schema from "effect/Schema";

import { CustomerId, OrderEventId, OrderId, OrderNumber, PaymentId, ProductId } from "./ids.ts";

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

/** What mom records by hand. QPay and Khaan payments come from their own callbacks, never the dashboard. */
export const ManualPayment = Schema.Struct({
  orderId: OrderId,
  amount: RecordPayment.fields.amount,
  method: Schema.Literals(["cash", "transfer"]),
});

export type ManualPayment = typeof ManualPayment.Type;

/** Ship, deliver and cancel take only the order. */
export const OrderAction = Schema.Struct({ orderId: OrderId });

/** `to_ship`: paid, or new on COD. `awaiting_payment`: new on prepay. */
export const OrderQueue = Schema.Literals(["to_ship", "awaiting_payment"]);

export type OrderQueue = typeof OrderQueue.Type;

/**
 * The inbox: every filter given must match. `phone` matches anywhere in the number. `today` is since midnight in
 * Ulaanbaatar. Newest first, at most 100 rows.
 */
export const ListOrders = Schema.Struct({
  queue: Schema.optional(OrderQueue),
  status: Schema.optional(OrderStatus),
  today: Schema.optional(Schema.Boolean),
  // Any 3 to 8 digits of the phone: she often remembers only the last four.
  phone: Schema.optional(Schema.String.check(Schema.isPattern(/^[0-9]{3,8}$/u))),
  number: Schema.optional(OrderNumber),
});

export type ListOrders = typeof ListOrders.Type;

/** A line as the dashboard shows it. The photo tells look-alike products apart. */
export const OrderLineView = Schema.Struct({
  productId: ProductId,
  name: Schema.String,
  brand: Schema.String,
  count: Schema.Int,
  image: Schema.NullOr(Schema.String),
  quantity: Schema.Int,
  unitPrice: Schema.Int,
});

export type OrderLineView = typeof OrderLineView.Type;

/** Balance is `total - paid`: above 0 the customer owes, below 0 a refund is due. */
export const OrderSummary = Schema.Struct({
  id: OrderId,
  number: OrderNumber,
  status: OrderStatus,
  terms: PaymentTerms,
  source: OrderSource,
  fulfillment: Fulfillment,
  total: Schema.Int,
  paid: Schema.Int,
  balance: Schema.Int,
  customerPhone: Schema.NullOr(Schema.String),
  address: Schema.NullOr(Schema.String),
  notes: Schema.NullOr(Schema.String),
  lines: Schema.Array(OrderLineView),
  createdAt: Schema.Date,
});

export type OrderSummary = typeof OrderSummary.Type;

/** How many orders sit behind each filter chip on the orders list. */
export const OrderCounts = Schema.Struct({
  toShip: Schema.Int,
  awaitingPayment: Schema.Int,
  shipped: Schema.Int,
});

export type OrderCounts = typeof OrderCounts.Type;

const LineSnapshot = Schema.Struct({
  productId: ProductId,
  quantity: Schema.Int,
  unitPrice: Schema.Int,
});

const OrderSnapshot = Schema.Struct({
  lines: Schema.Array(LineSnapshot),
  deliveryFee: Schema.Int,
  total: Schema.Int,
});

/**
 * `order_events.data`, per event type: a payment, an edit's before and
 * after, or the vit-store status a legacy order was imported with.
 */
export const OrderEventData = Schema.NullOr(
  Schema.Union([
    Schema.Struct({ paymentId: PaymentId, amount: Schema.Int, method: PaymentMethod }),
    Schema.Struct({ before: OrderSnapshot, after: OrderSnapshot }),
    Schema.Struct({ legacyStatus: Schema.String }),
  ]),
);

export type OrderEventData = typeof OrderEventData.Type;

export const OrderDetail = Schema.Struct({
  ...OrderSummary.fields,
  customerId: Schema.NullOr(CustomerId),
  deliveryFee: Schema.Int,
  payments: Schema.Array(
    Schema.Struct({
      id: PaymentId,
      amount: Schema.Int,
      method: PaymentMethod,
      actor: Schema.String,
      createdAt: Schema.Date,
    }),
  ),
  events: Schema.Array(
    Schema.Struct({
      id: OrderEventId,
      type: OrderEventType,
      actor: Schema.String,
      data: OrderEventData,
      createdAt: Schema.Date,
    }),
  ),
});

export type OrderDetail = typeof OrderDetail.Type;

/** A known customer, for the manual-order draft: "existing customer, 3 past orders". */
export const Customer = Schema.Struct({
  id: CustomerId,
  phone: Schema.NullOr(Schema.String),
  name: Schema.NullOr(Schema.String),
  address: Schema.NullOr(Schema.String),
  orders: Schema.Int,
});

export type Customer = typeof Customer.Type;

export class CustomerNotFound extends Schema.TaggedError<CustomerNotFound>()("CustomerNotFound", {
  phone: Phone,
}) {}

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
