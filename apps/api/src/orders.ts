import {
  InvalidOrder,
  newId,
  OrderEventId,
  OrderId,
  OrderNotFound,
  PaymentConflict,
  PaymentId,
  ProductUnavailable,
  RefundExceedsPaid,
  WrongOrderStatus,
} from "@amerik/contracts";
import type {
  EditOrder,
  OrderEventType,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PlaceOrder,
  ProductId,
  RecordPayment,
} from "@amerik/contracts";
import { customerByPhone, Database, moveStock, schema, transaction } from "@amerik/db";
import { and, eq, inArray, isNull, sum } from "drizzle-orm";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

// The rules behind every function here: docs/COMMERCE-RULES.md.
const { orderEvents, orderLines, orders, payments, products } = schema;

/** The bot and the websites: prepay only, catalog prices only. */
const SELF_SERVE = new Set<OrderSource>(["messenger_bot", "web", "brand_site"]);

type Lines = PlaceOrder["lines"];

type PricedLine = {
  readonly productId: ProductId;
  readonly quantity: number;
  readonly unitPrice: number;
};

type OrderSnapshot = {
  readonly lines: ReadonlyArray<PricedLine>;
  readonly deliveryFee: number;
  readonly total: number;
};

/** `order_events.data`: what the timeline shows and [undo] restores. */
type EventData =
  | { readonly paymentId: PaymentId; readonly amount: number; readonly method: PaymentMethod }
  | { readonly before: OrderSnapshot; readonly after: OrderSnapshot };

const now = DateTime.now.pipe(Effect.map(DateTime.toDateUtc));

const checkLines = (source: OrderSource, lines: Lines) => {
  if (new Set(lines.map((line) => line.productId)).size !== lines.length) {
    return Effect.fail(new InvalidOrder({ reason: "duplicate_line" }));
  }

  if (SELF_SERVE.has(source) && lines.some((line) => line.unitPrice !== undefined)) {
    return Effect.fail(new InvalidOrder({ reason: "price_override" }));
  }

  return Effect.void;
};

/**
 * Prices each line: its override, else the price frozen on the order, else
 * the product's price now. A product new to the order must exist and not be archived.
 */
const priceLines = Effect.fn("priceLines")(function* priceLines(
  lines: Lines,
  frozen: ReadonlyMap<ProductId, number>,
) {
  const db = yield* Database;
  const added = lines.map((line) => line.productId).filter((id) => !frozen.has(id));

  const current =
    added.length === 0
      ? []
      : yield* db
          .select({ id: products.id, price: products.price })
          .from(products)
          .where(and(inArray(products.id, added), isNull(products.archivedAt)));

  const prices = new Map([...current.map(({ id, price }) => [id, price] as const), ...frozen]);

  return yield* Effect.forEach(lines, (line) => {
    const price = prices.get(line.productId);

    return price === undefined
      ? Effect.fail(new ProductUnavailable({ productId: line.productId }))
      : Effect.succeed({
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice ?? price,
        });
  });
});

const totalOf = (lines: ReadonlyArray<{ quantity: number; unitPrice: number }>, fee: number) =>
  lines.reduce((total, line) => total + line.quantity * line.unitPrice, fee);

/** Every order write starts here: the row lock serializes edits, payments and status changes. */
const lockOrder = Effect.fn("lockOrder")(function* lockOrder(orderId: OrderId) {
  const db = yield* Database;
  const [order] = yield* db.select().from(orders).where(eq(orders.id, orderId)).for("update");

  if (order === undefined) return yield* new OrderNotFound({ orderId });

  return order;
});

const paidSum = Effect.fn("paidSum")(function* paidSum(orderId: OrderId) {
  const db = yield* Database;

  const [row] = yield* db
    .select({ paid: sum(payments.amount) })
    .from(payments)
    .where(eq(payments.orderId, orderId));

  return Number(row?.paid ?? 0);
});

const logEvent = Effect.fn("logEvent")(function* logEvent(
  orderId: OrderId,
  type: OrderEventType,
  actor: string,
  data?: EventData,
) {
  const db = yield* Database;

  yield* db.insert(orderEvents).values({
    id: yield* newId(OrderEventId),
    orderId,
    type,
    actor,
    data,
    createdAt: yield* now,
  });
});

const setStatus = Effect.fn("setStatus")(function* setStatus(
  orderId: OrderId,
  status: Exclude<OrderStatus, "new">,
  actor: string,
) {
  const db = yield* Database;

  yield* db.update(orders).set({ status }).where(eq(orders.id, orderId));
  yield* logEvent(orderId, status, actor);
});

/**
 * Moves stock by `sign × quantity` for every line, in product-id order so two
 * transactions never lock the same products in opposite orders.
 */
const moveLines = Effect.fn("moveLines")(function* moveLines(
  orderId: OrderId,
  reason: "sale" | "cancel",
  actor: string,
) {
  const db = yield* Database;

  const lines = yield* db
    .select()
    .from(orderLines)
    .where(eq(orderLines.orderId, orderId))
    .orderBy(orderLines.productId);

  for (const line of lines) {
    const product = yield* moveStock({
      productId: line.productId,
      change: reason === "sale" ? -line.quantity : line.quantity,
      reason,
      orderId,
      actor,
    });

    // A sold line records the product's cost at the moment stock moves.
    if (reason === "sale") {
      yield* db
        .update(orderLines)
        .set({ unitCost: product.cost })
        .where(and(eq(orderLines.orderId, orderId), eq(orderLines.productId, line.productId)));
    }
  }
});

/** Stock goes down the first time an order leaves `new`, to `paid` or `shipped`. */
const leaveNew = Effect.fn("leaveNew")(function* leaveNew(
  orderId: OrderId,
  status: "paid" | "shipped",
  actor: string,
) {
  yield* moveLines(orderId, "sale", actor);
  yield* setStatus(orderId, status, actor);
});

/** A `new` order with money on it becomes `paid` once its balance reaches zero or below. */
const settle = Effect.fn("settle")(function* settle(
  order: { readonly id: OrderId; readonly status: OrderStatus },
  total: number,
  paid: number,
  actor: string,
) {
  if (order.status !== "new" || paid <= 0 || paid < total) return order.status;

  yield* leaveNew(order.id, "paid", actor);

  return "paid" as const;
});

export const placeOrder = Effect.fn("placeOrder")(function* placeOrder(
  input: PlaceOrder,
  actor: string,
) {
  const db = yield* Database;

  yield* checkLines(input.source, input.lines);

  if (input.terms === "cod" && SELF_SERVE.has(input.source)) {
    return yield* new InvalidOrder({ reason: "cod_not_allowed" });
  }

  const lines = yield* priceLines(input.lines, new Map());
  const total = totalOf(lines, input.deliveryFee);

  const customerId =
    input.phone === undefined
      ? undefined
      : yield* customerByPhone({ phone: input.phone, name: input.name, address: input.address });

  const id = yield* newId(OrderId);

  const [order] = yield* db
    .insert(orders)
    .values({
      id,
      customerId,
      status: "new",
      terms: input.terms,
      source: input.source,
      fulfillment: input.fulfillment,
      address: input.address,
      notes: input.notes,
      deliveryFee: input.deliveryFee,
      total,
      createdAt: yield* now,
    })
    .returning({ number: orders.number });

  if (order === undefined) return yield* Effect.die("placeOrder: the insert returned no row");

  yield* db.insert(orderLines).values(lines.map((line) => ({ ...line, orderId: id })));
  yield* logEvent(id, "placed", actor);

  return { orderId: id, number: order.number, total };
}, transaction);

/** Allowed until shipped. Stock that already moved follows the difference; the status stays. */
export const editOrder = Effect.fn("editOrder")(function* editOrder(
  input: EditOrder,
  actor: string,
) {
  const db = yield* Database;
  const order = yield* lockOrder(input.orderId);

  if (order.status !== "new" && order.status !== "paid") {
    return yield* new WrongOrderStatus({ orderId: order.id, status: order.status });
  }

  yield* checkLines(order.source, input.lines);

  const before = yield* db.select().from(orderLines).where(eq(orderLines.orderId, order.id));

  const lines = yield* priceLines(
    input.lines,
    new Map(before.map((line) => [line.productId, line.unitPrice])),
  );

  const costs = new Map(before.map((line) => [line.productId, line.unitCost]));

  if (order.status === "paid") {
    const was = new Map(before.map((line) => [line.productId, line.quantity]));
    const will = new Map(lines.map((line) => [line.productId, line.quantity]));

    for (const productId of [...new Set([...was.keys(), ...will.keys()])].toSorted()) {
      const change = (was.get(productId) ?? 0) - (will.get(productId) ?? 0);

      if (change !== 0) {
        const product = yield* moveStock({
          productId,
          change,
          reason: "edit",
          orderId: order.id,
          actor,
        });

        if (!costs.has(productId)) costs.set(productId, product.cost);
      }
    }
  }

  const total = totalOf(lines, input.deliveryFee);

  yield* db.delete(orderLines).where(eq(orderLines.orderId, order.id));
  yield* db
    .insert(orderLines)
    .values(
      lines.map((line) => ({ ...line, orderId: order.id, unitCost: costs.get(line.productId) })),
    );
  yield* db
    .update(orders)
    .set({
      total,
      deliveryFee: input.deliveryFee,
      address: input.address ?? order.address,
      notes: input.notes ?? order.notes,
    })
    .where(eq(orders.id, order.id));

  // The edit's before and after, for the timeline and [undo].
  yield* logEvent(order.id, "edited", actor, {
    before: { lines: before, deliveryFee: order.deliveryFee, total: order.total },
    after: { lines, deliveryFee: input.deliveryFee, total },
  });

  const status = yield* settle(order, total, yield* paidSum(order.id), actor);

  return { total, status };
}, transaction);

/**
 * Money is recorded whatever the status: a QPay callback after auto-cancel
 * still happened, and shows as a refund owed. Replaying a provider
 * transaction returns the payment already recorded.
 */
export const recordPayment = Effect.fn("recordPayment")(function* recordPayment(
  input: RecordPayment,
  actor: string,
) {
  const db = yield* Database;
  const order = yield* lockOrder(input.orderId);

  if (input.providerRef !== undefined) {
    const [existing] = yield* db
      .select()
      .from(payments)
      .where(eq(payments.providerRef, input.providerRef));

    if (existing !== undefined) {
      if (existing.orderId !== order.id || existing.amount !== input.amount) {
        return yield* new PaymentConflict({ providerRef: input.providerRef });
      }

      return { paymentId: existing.id, status: order.status };
    }
  }

  const before = yield* paidSum(order.id);
  const paid = before + input.amount;

  if (paid < 0) return yield* new RefundExceedsPaid({ orderId: order.id, paid: before });

  const paymentId = yield* newId(PaymentId);

  yield* db.insert(payments).values({
    id: paymentId,
    orderId: order.id,
    amount: input.amount,
    method: input.method,
    providerRef: input.providerRef,
    actor,
    createdAt: yield* now,
  });
  yield* logEvent(order.id, "payment_recorded", actor, {
    paymentId,
    amount: input.amount,
    method: input.method,
  });

  return { paymentId, status: yield* settle(order, order.total, paid, actor) };
}, transaction);

/** `paid` ships. A COD order ships from `new`, unpaid, and its stock moves now. */
export const markShipped = Effect.fn("markShipped")(function* markShipped(
  orderId: OrderId,
  actor: string,
) {
  const order = yield* lockOrder(orderId);

  if (order.status === "paid") return yield* setStatus(order.id, "shipped", actor);

  if (order.status === "new" && order.terms === "cod") {
    return yield* leaveNew(order.id, "shipped", actor);
  }

  return yield* new WrongOrderStatus({ orderId: order.id, status: order.status });
}, transaction);

export const markDelivered = Effect.fn("markDelivered")(function* markDelivered(
  orderId: OrderId,
  actor: string,
) {
  const order = yield* lockOrder(orderId);

  if (order.status !== "shipped") {
    return yield* new WrongOrderStatus({ orderId: order.id, status: order.status });
  }

  yield* setStatus(order.id, "delivered", actor);
}, transaction);

/** From `new` or `paid`. A paid order's stock comes back; its payments now show as a refund owed. */
export const cancelOrder = Effect.fn("cancelOrder")(function* cancelOrder(
  orderId: OrderId,
  actor: string,
) {
  const order = yield* lockOrder(orderId);

  if (order.status !== "new" && order.status !== "paid") {
    return yield* new WrongOrderStatus({ orderId: order.id, status: order.status });
  }

  if (order.status === "paid") yield* moveLines(order.id, "cancel", actor);

  yield* setStatus(order.id, "cancelled", actor);
}, transaction);
