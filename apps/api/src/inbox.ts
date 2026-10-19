import { OrderEventData, OrderNotFound } from "@amerik/contracts";
import type { ListOrders, OrderId, OrderLineView, OrderQueue } from "@amerik/contracts";
import { Database, dieOnDatabaseError, schema } from "@amerik/db";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sum,
} from "drizzle-orm";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

// What mom reads: the order inbox, one order, and the home screen.
const { brands, customers, orderEvents, orderLines, orders, payments, products } = schema;

const summary = {
  id: orders.id,
  number: orders.number,
  status: orders.status,
  terms: orders.terms,
  source: orders.source,
  fulfillment: orders.fulfillment,
  total: orders.total,
  createdAt: orders.createdAt,
  customerName: customers.name,
  customerPhone: customers.phone,
  address: orders.address,
  paid: sum(payments.amount),
};

const withBalance = <Row extends { total: number; paid: string | null }>(row: Row) => {
  const paid = Number(row.paid ?? 0);

  return { ...row, paid, balance: row.total - paid };
};

/** Mongolia keeps UTC+8 all year, so "today" starts at midnight there. */
const startOfToday = DateTime.now.pipe(
  Effect.map((now) =>
    DateTime.toDateUtc(
      DateTime.startOf(DateTime.setZoneNamedUnsafe(now, "Asia/Ulaanbaatar"), "day"),
    ),
  ),
);

/** COMMERCE-RULES: a paid order ships, and so does a COD order still `new`. */
const inQueue = (queue: OrderQueue) =>
  queue === "to_ship"
    ? or(eq(orders.status, "paid"), and(eq(orders.status, "new"), eq(orders.terms, "cod")))
    : and(eq(orders.status, "new"), eq(orders.terms, "prepay"));

const firstImage = (images: ReadonlyArray<string>) => images[0] ?? null;

/** Each order's lines with brand, count and photo, by product name. */
const lineViews = Effect.fn("lineViews")(function* lineViews(orderIds: ReadonlyArray<OrderId>) {
  const db = yield* Database;
  const byOrder = new Map<OrderId, Array<typeof OrderLineView.Type>>();

  if (orderIds.length === 0) return byOrder;

  const rows = yield* db
    .select({
      orderId: orderLines.orderId,
      productId: orderLines.productId,
      name: products.name,
      brand: brands.name,
      count: products.count,
      images: products.images,
      quantity: orderLines.quantity,
      unitPrice: orderLines.unitPrice,
    })
    .from(orderLines)
    .innerJoin(products, eq(products.id, orderLines.productId))
    .innerJoin(brands, eq(brands.id, products.brandId))
    .where(inArray(orderLines.orderId, orderIds))
    .orderBy(asc(products.name))
    .pipe(dieOnDatabaseError);

  for (const { orderId, images, ...line } of rows) {
    const lines = byOrder.get(orderId) ?? [];
    lines.push({ ...line, image: firstImage(images) });
    byOrder.set(orderId, lines);
  }

  return byOrder;
});

export const listOrders = Effect.fn("listOrders")(function* listOrders(input: ListOrders) {
  const db = yield* Database;

  const rows = yield* db
    .select(summary)
    .from(orders)
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .leftJoin(payments, eq(payments.orderId, orders.id))
    .where(
      and(
        input.queue === undefined ? undefined : inQueue(input.queue),
        input.status === undefined ? undefined : eq(orders.status, input.status),
        input.today === true ? gte(orders.createdAt, yield* startOfToday) : undefined,
        input.phone === undefined ? undefined : eq(customers.phone, input.phone),
        input.number === undefined ? undefined : eq(orders.number, input.number),
      ),
    )
    .groupBy(orders.id, customers.id)
    .orderBy(desc(orders.createdAt))
    .limit(100)
    .pipe(dieOnDatabaseError);

  const lines = yield* lineViews(rows.map((row) => row.id));

  return rows.map((row) => ({ ...withBalance(row), lines: lines.get(row.id) ?? [] }));
});

/** One order with its lines, payments and timeline, oldest event first. */
export const getOrder = Effect.fn("getOrder")(function* getOrder(orderId: OrderId) {
  const db = yield* Database;

  const [[order], lines, paid, events] = yield* Effect.all([
    db
      .select({
        ...summary,
        customerId: orders.customerId,
        notes: orders.notes,
        deliveryFee: orders.deliveryFee,
      })
      .from(orders)
      .leftJoin(customers, eq(customers.id, orders.customerId))
      .leftJoin(payments, eq(payments.orderId, orders.id))
      .where(eq(orders.id, orderId))
      .groupBy(orders.id, customers.id),
    lineViews([orderId]),
    db
      .select({
        id: payments.id,
        amount: payments.amount,
        method: payments.method,
        actor: payments.actor,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .where(eq(payments.orderId, orderId))
      .orderBy(asc(payments.createdAt)),
    db
      .select({
        id: orderEvents.id,
        type: orderEvents.type,
        actor: orderEvents.actor,
        data: orderEvents.data,
        createdAt: orderEvents.createdAt,
      })
      .from(orderEvents)
      .where(eq(orderEvents.orderId, orderId))
      .orderBy(asc(orderEvents.createdAt)),
  ]).pipe(dieOnDatabaseError);

  if (order === undefined) return yield* new OrderNotFound({ orderId });

  return {
    ...withBalance(order),
    lines: lines.get(orderId) ?? [],
    payments: paid,
    // The rows are ours, so a shape the schema rejects is a bug, not input.
    events: yield* Effect.forEach(events, ({ data, ...event }) =>
      Schema.decodeUnknownEffect(OrderEventData)(data).pipe(
        Effect.map((decoded) => ({ ...event, data: decoded })),
        Effect.orDie,
      ),
    ),
  };
});

/** At or below this many bottles, a product shows as running out. */
const LOW_STOCK = 3;

const card = {
  productId: products.id,
  name: products.name,
  brand: brands.name,
  count: products.count,
  images: products.images,
};

export const home = Effect.fn("home")(function* home() {
  const db = yield* Database;
  const today = yield* startOfToday;

  const [[paidToday], cod, [toShip], shelf, [awaiting], low] = yield* Effect.all([
    db
      .select({ amount: sum(payments.amount) })
      .from(payments)
      .where(and(gte(payments.createdAt, today), gt(payments.amount, 0))),
    // COD money is still out until the courier hands it over.
    db
      .select({ total: orders.total, paid: sum(payments.amount) })
      .from(orders)
      .leftJoin(payments, eq(payments.orderId, orders.id))
      .where(and(eq(orders.terms, "cod"), inArray(orders.status, ["new", "shipped"])))
      .groupBy(orders.id),
    db.select({ orders: count() }).from(orders).where(inQueue("to_ship")),
    db
      .select({ ...card, quantity: sum(orderLines.quantity) })
      .from(orderLines)
      .innerJoin(orders, eq(orders.id, orderLines.orderId))
      .innerJoin(products, eq(products.id, orderLines.productId))
      .innerJoin(brands, eq(brands.id, products.brandId))
      .where(inQueue("to_ship"))
      .groupBy(products.id, brands.id)
      .orderBy(desc(sum(orderLines.quantity)), asc(products.name)),
    db.select({ orders: count() }).from(orders).where(inQueue("awaiting_payment")),
    db
      .select({ ...card, stock: products.stock })
      .from(products)
      .innerJoin(brands, eq(brands.id, products.brandId))
      .where(
        and(isNull(products.archivedAt), isNotNull(products.stock), lte(products.stock, LOW_STOCK)),
      )
      .orderBy(asc(products.stock), asc(products.name))
      .limit(6),
  ]).pipe(dieOnDatabaseError);

  const owed = cod.map(withBalance).filter((order) => order.balance > 0);

  const pulled = shelf.map(({ images, quantity, ...product }) => ({
    ...product,
    image: firstImage(images),
    quantity: Number(quantity ?? 0),
  }));

  return {
    paidToday: Number(paidToday?.amount ?? 0),
    codToCollect: owed.reduce((total, order) => total + order.balance, 0),
    codOrders: owed.length,
    toShip: toShip?.orders ?? 0,
    toShipPieces: pulled.reduce((total, product) => total + product.quantity, 0),
    awaitingPayment: awaiting?.orders ?? 0,
    shelf: pulled,
    lowStock: low.flatMap(({ images, stock, ...product }) =>
      stock === null ? [] : [{ ...product, image: firstImage(images), stock }],
    ),
  };
});
