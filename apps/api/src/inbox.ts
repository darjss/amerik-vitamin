import { LOW_STOCK, OrderNotFound } from "@amerik/contracts";
import type { ListOrders, OrderId, OrderQueue } from "@amerik/contracts";
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
  like,
  lte,
  or,
  sum,
} from "drizzle-orm";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

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
  customerPhone: customers.phone,
  address: orders.address,
  notes: orders.notes,
  paid: sum(payments.amount).mapWith(Number),
};

const withBalance = <Row extends { total: number; paid: number | null }>(row: Row) => {
  const paid = row.paid ?? 0;

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

/** Each order's lines with brand, count and photo, by product name. */
const lineViews = Effect.fn("lineViews")(function* lineViews(orderIds: ReadonlyArray<OrderId>) {
  const db = yield* Database;

  const rows =
    orderIds.length === 0
      ? []
      : yield* db
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

  return Map.groupBy(
    rows.map(({ images, ...line }) => ({ ...line, image: images[0] ?? null })),
    (line) => line.orderId,
  );
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
        input.phone === undefined ? undefined : like(customers.phone, `%${input.phone}%`),
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

  // The customer's order count rides along, so the page needs no second round
  // trip from her phone. (A subquery inside inArray renders empty here.)
  const [history] =
    order.customerId === null
      ? [{ orders: 0 }]
      : yield* db
          .select({ orders: count() })
          .from(orders)
          .where(eq(orders.customerId, order.customerId))
          .pipe(dieOnDatabaseError);

  return {
    ...withBalance(order),
    lines: lines.get(orderId) ?? [],
    payments: paid,
    customerOrders: history?.orders ?? 0,
    // RpcServer encodes the result against `OrderEventData`, so a row the
    // schema rejects still dies there instead of reaching the client.
    events,
  };
});

/** The two queues behind home's numbers and the orders list's chips. */
const queueCounts = Effect.fn("queueCounts")(function* queueCounts() {
  const db = yield* Database;

  const [[toShip], [awaitingPayment]] = yield* Effect.all([
    db.select({ orders: count() }).from(orders).where(inQueue("to_ship")),
    db.select({ orders: count() }).from(orders).where(inQueue("awaiting_payment")),
  ]).pipe(dieOnDatabaseError);

  return { toShip: toShip?.orders ?? 0, awaitingPayment: awaitingPayment?.orders ?? 0 };
});

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

  const [[paidToday], cod, shelf, low] = yield* Effect.all([
    db
      .select({ amount: sum(payments.amount).mapWith(Number) })
      .from(payments)
      .where(and(gte(payments.createdAt, today), gt(payments.amount, 0))),
    // COD money is still out until the courier hands it over.
    db
      .select({ total: orders.total, paid: sum(payments.amount).mapWith(Number) })
      .from(orders)
      .leftJoin(payments, eq(payments.orderId, orders.id))
      .where(and(eq(orders.terms, "cod"), inArray(orders.status, ["new", "shipped"])))
      .groupBy(orders.id),
    db
      .select({ ...card, quantity: sum(orderLines.quantity).mapWith(Number) })
      .from(orderLines)
      .innerJoin(orders, eq(orders.id, orderLines.orderId))
      .innerJoin(products, eq(products.id, orderLines.productId))
      .innerJoin(brands, eq(brands.id, products.brandId))
      .where(inQueue("to_ship"))
      .groupBy(products.id, brands.id)
      .orderBy(desc(sum(orderLines.quantity)), asc(products.name)),
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

  const { toShip, awaitingPayment } = yield* queueCounts();
  const owed = cod.map(withBalance).filter((order) => order.balance > 0);

  const pulled = shelf.map(({ images, quantity, ...product }) => ({
    ...product,
    image: images[0] ?? null,
    quantity: quantity ?? 0,
  }));

  return {
    paidToday: paidToday?.amount ?? 0,
    codToCollect: owed.reduce((total, order) => total + order.balance, 0),
    codOrders: owed.length,
    toShip,
    toShipPieces: pulled.reduce((total, product) => total + product.quantity, 0),
    awaitingPayment,
    shelf: pulled,
    lowStock: low.flatMap(({ images, stock, ...product }) =>
      stock === null ? [] : [{ ...product, image: images[0] ?? null, stock }],
    ),
  };
});

export const orderCounts = Effect.fn("orderCounts")(function* orderCounts() {
  const db = yield* Database;

  const [shipped] = yield* db
    .select({ orders: count() })
    .from(orders)
    .where(eq(orders.status, "shipped"))
    .pipe(dieOnDatabaseError);

  return { ...(yield* queueCounts()), shipped: shipped?.orders ?? 0 };
});
