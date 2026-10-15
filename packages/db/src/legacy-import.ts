import {
  CustomerId,
  Fulfillment,
  newId,
  OrderEventId,
  OrderEventType,
  OrderId,
  OrderSource,
  OrderStatus,
  PaymentId,
  PaymentMethod,
  PaymentTerms,
} from "@amerik/contracts";
import * as PgClient from "@effect/sql-pg/PgClient";
import { count, eq, isNotNull, isNull, sql, sum } from "drizzle-orm";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

import { Database, dieOnDatabaseError, transaction } from "./database.ts";
import { customers, orderEvents, orders, payments } from "./schema.ts";

/**
 * Copies vit-store's customers, orders and successful payments into `shop`,
 * matched on `legacy_id` so a re-run only adds or updates what changed, and
 * prints a reconciliation report. Order lines wait for the new catalog.
 * The mapping is in the SQL below; docs/LEGACY.md explains it.
 */

const actor = "legacy-import";

const legacyUrl = Config.Redacted("LEGACY_DATABASE_URL").pipe(
  Config.orElse(() =>
    Config.Redacted("DATABASE_URL").pipe(
      Config.map((url) => {
        const legacy = new URL(Redacted.value(url));
        legacy.pathname = "/vitstore";

        return Redacted.make(legacy.href);
      }),
    ),
  ),
);

const LegacyCustomer = Schema.Struct({
  legacyId: Schema.Int,
  phone: Schema.NullOr(Schema.String),
  address: Schema.NullOr(Schema.String),
  createdAt: Schema.Date,
});

const LegacyOrder = Schema.Struct({
  legacyId: Schema.Int,
  customerLegacyId: Schema.Int,
  legacyStatus: Schema.String,
  status: OrderStatus,
  terms: PaymentTerms,
  source: OrderSource,
  fulfillment: Fulfillment,
  address: Schema.NullOr(Schema.String),
  notes: Schema.NullOr(Schema.String),
  deliveryFee: Schema.Int,
  total: Schema.Int,
  createdAt: Schema.Date,
  changedAt: Schema.Date,
});

const LegacyPayment = Schema.Struct({
  legacyId: Schema.Int,
  orderLegacyId: Schema.Int,
  amount: Schema.Int,
  method: PaymentMethod,
  providerRef: Schema.NullOr(Schema.String),
  createdAt: Schema.Date,
});

const Tally = Schema.Struct({ key: Schema.String, rows: Schema.Int, amount: Schema.Int });

const Skip = Schema.Struct({ table: Schema.String, reason: Schema.String, rows: Schema.Int });

type Legacy = Effect.Success<ReturnType<typeof readLegacy>>;

class ReconciliationMismatch extends Data.TaggedError("ReconciliationMismatch")<{
  readonly checks: ReadonlyArray<string>;
}> {}

const decodeRows = <S extends Schema.Top>(schema: S) =>
  Schema.decodeUnknownEffect(Schema.Array(schema));

/** vit-store timestamps are `timestamp without time zone` holding UTC. */
const readLegacy = Effect.fn("LegacyImport.readLegacy")(function* readLegacy(
  legacy: PgClient.PgClient,
) {
  // Since vit-store #115 `created` is unpaid and `pending` is paid, waiting to
  // ship. Checkout adds a 6,000₮ delivery fee to the total and the admin form
  // doesn't, so an order whose priced lines sum to its total was typed in by
  // mom: a chat order on COD. An unknown status or provider maps to NULL and
  // fails the decode.
  const mappedOrders = legacy`
    paid AS (
      SELECT DISTINCT order_id FROM ecom_vit_payment WHERE status = 'success' AND deleted_at IS NULL
    ),
    line_totals AS (
      SELECT order_id, bool_and(price IS NOT NULL) AS priced, sum(price * quantity) AS amount
      FROM ecom_vit_order_detail WHERE deleted_at IS NULL GROUP BY order_id
    ),
    classified AS (
      SELECT o.*, c.id AS customer_legacy_id, paid.order_id IS NOT NULL AS is_paid,
        coalesce(l.priced AND l.amount = o.total, false) AS manual
      FROM ecom_vit_order o
      JOIN ecom_vit_customer c ON c.phone = o.customer_phone
      LEFT JOIN paid ON paid.order_id = o.id
      LEFT JOIN line_totals l ON l.order_id = o.id
      WHERE o.deleted_at IS NULL
    ),
    mapped_orders AS (
      SELECT id AS legacy_id, customer_legacy_id, status AS legacy_status,
        CASE
          WHEN status = 'created' THEN 'cancelled'
          WHEN status = 'pending' AND is_paid THEN 'paid'
          WHEN status = 'pending' THEN 'new'
          WHEN status IN ('shipped', 'delivered') THEN 'delivered'
          WHEN status IN ('cancelled', 'refunded') THEN 'cancelled'
        END AS v2_status,
        CASE WHEN manual THEN 'cod' ELSE 'prepay' END AS terms,
        CASE WHEN manual THEN 'messenger_human' ELSE 'web' END AS source,
        CASE
          WHEN delivery_provider IN ('tu-delivery', 'avidaa', 'self') THEN 'courier'
          WHEN delivery_provider = 'pick-up' THEN 'pickup'
        END AS fulfillment,
        CASE WHEN manual THEN 0 ELSE 6000 END AS delivery_fee,
        nullif(btrim(address), '') AS address, nullif(btrim(notes), '') AS notes, total,
        created_at AT TIME ZONE 'UTC' AS created_at,
        greatest(created_at, updated_at) AT TIME ZONE 'UTC' AS changed_at
      FROM classified
    )`;

  // A successful payment last changed when it succeeded.
  const successfulPayments = legacy`
    successful_payments AS (
      SELECT p.id AS legacy_id, p.order_id AS order_legacy_id, p.amount, p.provider AS method,
        CASE WHEN p.provider = 'qpay' THEN p.invoice_id ELSE k.fingerprint END AS provider_ref,
        greatest(p.created_at, p.updated_at) AT TIME ZONE 'UTC' AS created_at
      FROM ecom_vit_payment p
      JOIN ecom_vit_order o ON o.id = p.order_id
      LEFT JOIN ecom_vit_khaan_consumed_transaction k
        ON p.provider = 'transfer' AND k.payment_number = p.payment_number
      WHERE p.status = 'success' AND p.deleted_at IS NULL AND o.deleted_at IS NULL
    )`;

  const liveOrderPhones = legacy`SELECT customer_phone FROM ecom_vit_order WHERE deleted_at IS NULL`;

  return {
    customers: yield* legacy`
      SELECT id AS "legacyId", CASE WHEN phone::text ~ '^[0-9]{8}$' THEN phone::text END AS phone,
        nullif(btrim(address), '') AS address, created_at AT TIME ZONE 'UTC' AS "createdAt"
      FROM ecom_vit_customer
      WHERE deleted_at IS NULL OR phone IN (${liveOrderPhones})
      ORDER BY id`.pipe(Effect.flatMap(decodeRows(LegacyCustomer))),

    // Oldest first, so the identity column numbers orders by age.
    orders: yield* legacy`
      WITH ${mappedOrders}
      SELECT legacy_id AS "legacyId", customer_legacy_id AS "customerLegacyId",
        legacy_status AS "legacyStatus", v2_status AS status, terms, source, fulfillment,
        address, notes, delivery_fee AS "deliveryFee", total,
        created_at AS "createdAt", changed_at AS "changedAt"
      FROM mapped_orders ORDER BY created_at, legacy_id`.pipe(
      Effect.flatMap(decodeRows(LegacyOrder)),
    ),

    payments: yield* legacy`
      WITH ${successfulPayments}
      SELECT legacy_id AS "legacyId", order_legacy_id AS "orderLegacyId", amount, method,
        provider_ref AS "providerRef", created_at AS "createdAt"
      FROM successful_payments ORDER BY legacy_id`.pipe(Effect.flatMap(decodeRows(LegacyPayment))),

    byStatus: yield* legacy`
      WITH ${mappedOrders}
      SELECT v2_status AS key, count(*)::int AS rows, sum(total)::int AS amount
      FROM mapped_orders GROUP BY v2_status`.pipe(Effect.flatMap(decodeRows(Tally))),

    byMethod: yield* legacy`
      WITH ${successfulPayments}
      SELECT method AS key, count(*)::int AS rows, sum(amount)::int AS amount
      FROM successful_payments GROUP BY method`.pipe(Effect.flatMap(decodeRows(Tally))),

    // Every legacy row, then every reason a row stays behind.
    skips: yield* legacy`
      SELECT 'customers' AS table, 'all rows' AS reason, count(*)::int AS rows FROM ecom_vit_customer
      UNION ALL SELECT 'orders', 'all rows', count(*)::int FROM ecom_vit_order
      UNION ALL SELECT 'payments', 'all rows', count(*)::int FROM ecom_vit_payment
      UNION ALL SELECT 'customers', 'soft-deleted, no live order', count(*)::int
        FROM ecom_vit_customer WHERE deleted_at IS NOT NULL AND phone NOT IN (${liveOrderPhones})
      UNION ALL SELECT 'orders', 'soft-deleted', count(*)::int
        FROM ecom_vit_order WHERE deleted_at IS NOT NULL
      UNION ALL SELECT 'payments', 'status ' || status, count(*)::int
        FROM ecom_vit_payment WHERE status <> 'success' GROUP BY status
      UNION ALL SELECT 'payments', 'successful, but it or its order is soft-deleted', count(*)::int
        FROM ecom_vit_payment p JOIN ecom_vit_order o ON o.id = p.order_id
        WHERE p.status = 'success' AND (p.deleted_at IS NOT NULL OR o.deleted_at IS NOT NULL)`.pipe(
      Effect.flatMap(decodeRows(Skip)),
    ),

    waiting: yield* legacy`
      SELECT 'lines' AS key, count(*)::int AS rows, coalesce(sum(d.quantity), 0)::int AS amount
      FROM ecom_vit_order_detail d JOIN ecom_vit_order o ON o.id = d.order_id
      WHERE d.deleted_at IS NULL AND o.deleted_at IS NULL`.pipe(Effect.flatMap(decodeRows(Tally))),
  };
});

/** Customers and payments upsert on `legacy_id`. Orders don't: a conflicting insert still burns an order number. */
const importAll = Effect.fn("LegacyImport.importAll")(function* importAll(legacy: Legacy) {
  const db = yield* Database;

  const customerRows = yield* Effect.forEach(legacy.customers, (row) =>
    Effect.map(newId(CustomerId), (id) => ({ ...row, id })),
  );

  const customerWrites =
    customerRows.length === 0
      ? []
      : yield* db
          .insert(customers)
          .values(customerRows)
          .onConflictDoUpdate({
            target: customers.legacyId,
            set: { phone: sql`excluded.phone`, address: sql`excluded.address` },
            setWhere: sql`(${customers.phone}, ${customers.address}) IS DISTINCT FROM (excluded.phone, excluded.address)`,
          })
          // xmax is 0 on a row this statement inserted and set on one it updated.
          .returning({ inserted: sql<boolean>`xmax = 0` });

  const customerIds = new Map(
    (yield* db
      .select({ legacyId: customers.legacyId, id: customers.id })
      .from(customers)
      .where(isNotNull(customers.legacyId))).map(({ legacyId, id }) => [legacyId, id]),
  );

  const known = new Map(
    (yield* db
      .select({
        legacyId: orders.legacyId,
        id: orders.id,
        customerId: orders.customerId,
        status: orders.status,
        terms: orders.terms,
        source: orders.source,
        fulfillment: orders.fulfillment,
        address: orders.address,
        notes: orders.notes,
        deliveryFee: orders.deliveryFee,
        total: orders.total,
      })
      .from(orders)
      .where(isNotNull(orders.legacyId))).map(({ legacyId, id, ...fields }) => [
      legacyId,
      { id, fields },
    ]),
  );

  const freshOrders = [];
  const changedOrders = [];

  for (const row of legacy.orders) {
    const customerId = customerIds.get(row.customerLegacyId);

    if (customerId === undefined) return yield* Effect.die(`order ${row.legacyId} has no customer`);

    const { status, terms, source, fulfillment, address, notes, deliveryFee, total } = row;

    const fields = {
      customerId,
      status,
      terms,
      source,
      fulfillment,
      address,
      notes,
      deliveryFee,
      total,
    };

    const current = known.get(row.legacyId);

    if (current === undefined) {
      const { legacyId, createdAt } = row;
      freshOrders.push({ id: yield* newId(OrderId), legacyId, createdAt, ...fields });
    } else if (!Equal.equals(current.fields, fields)) {
      changedOrders.push({ id: current.id, fields });
    }
  }

  // One insert, oldest first: Postgres numbers the rows in VALUES order.
  if (freshOrders.length > 0) yield* db.insert(orders).values(freshOrders);

  yield* Effect.forEach(changedOrders, ({ id, fields }) =>
    db.update(orders).set(fields).where(eq(orders.id, id)),
  );

  const orderIds = new Map(
    (yield* db
      .select({ legacyId: orders.legacyId, id: orders.id })
      .from(orders)
      .where(isNotNull(orders.legacyId))).map(({ legacyId, id }) => [legacyId, id]),
  );

  const orderIdOf = (legacyId: number) => {
    const id = orderIds.get(legacyId);

    return id === undefined
      ? Effect.die(`legacy order ${legacyId} was not imported`)
      : Effect.succeed(id);
  };

  const paymentRows = yield* Effect.forEach(legacy.payments, ({ orderLegacyId, ...row }) =>
    Effect.all({ id: newId(PaymentId), orderId: orderIdOf(orderLegacyId) }).pipe(
      Effect.map((ids) => ({ ...row, ...ids, actor })),
    ),
  );

  const paymentWrites =
    paymentRows.length === 0
      ? []
      : yield* db
          .insert(payments)
          .values(paymentRows)
          .onConflictDoNothing({ target: payments.legacyId })
          .returning({ id: payments.id });

  // A `placed` event per order, and one for its v2 status unless it is still `new`.
  const knownEvents = new Set(
    (yield* db
      .select({ orderId: orderEvents.orderId, type: orderEvents.type })
      .from(orderEvents)
      .where(eq(orderEvents.actor, actor))).map(({ orderId, type }) => `${orderId} ${type}`),
  );

  const freshEvents = [];

  for (const row of legacy.orders) {
    const orderId = yield* orderIdOf(row.legacyId);

    const final =
      row.status === "new"
        ? []
        : [
            {
              type: row.status,
              data: { legacyStatus: row.legacyStatus },
              createdAt: row.changedAt,
            },
          ];

    for (const event of [
      { type: "placed" as const, data: null, createdAt: row.createdAt },
      ...final,
    ]) {
      if (knownEvents.has(`${orderId} ${event.type}`)) continue;
      freshEvents.push({ id: yield* newId(OrderEventId), orderId, actor, ...event });
    }
  }

  if (freshEvents.length > 0) yield* db.insert(orderEvents).values(freshEvents);

  const insertedCustomers = customerWrites.filter((row) => row.inserted).length;

  yield* Console.log(
    [
      "Changes this run",
      `  customers     ${insertedCustomers} inserted, ${customerWrites.length - insertedCustomers} updated`,
      `  orders        ${freshOrders.length} inserted, ${changedOrders.length} updated`,
      `  payments      ${paymentWrites.length} inserted`,
      `  order_events  ${freshEvents.length} inserted`,
    ].join("\n"),
  );
});

const readV2 = Effect.fn("LegacyImport.readV2")(function* readV2() {
  const db = yield* Database;
  const legacyCustomers = isNotNull(customers.legacyId);

  return {
    customers: (yield* db.select({ rows: count() }).from(customers).where(legacyCustomers))[0]
      ?.rows,
    nullPhones: (yield* db
      .select({ rows: count() })
      .from(customers)
      .where(sql`${legacyCustomers} AND ${isNull(customers.phone)}`))[0]?.rows,
    byStatus: yield* db
      .select({ key: orders.status, rows: count(), amount: sum(orders.total).mapWith(Number) })
      .from(orders)
      .where(isNotNull(orders.legacyId))
      .groupBy(orders.status),
    byMethod: yield* db
      .select({ key: payments.method, rows: count(), amount: sum(payments.amount).mapWith(Number) })
      .from(payments)
      .where(isNotNull(payments.legacyId))
      .groupBy(payments.method),
    byEvent: yield* db
      .select({ key: orderEvents.type, rows: count() })
      .from(orderEvents)
      .where(eq(orderEvents.actor, actor))
      .groupBy(orderEvents.type),
    numbers: (yield* db
      .select({ number: orders.number })
      .from(orders)
      .where(isNotNull(orders.legacyId))
      .orderBy(orders.createdAt, orders.legacyId)).map((row) => row.number),
  };
});

/** Prints vit-store's numbers beside v2's and fails on any difference. */
const reconcile = Effect.fn("LegacyImport.reconcile")(function* reconcile(legacy: Legacy) {
  const v2 = yield* readV2();

  const tally = (
    tallies: ReadonlyArray<{ key: string; rows: number; amount: number | null }>,
    key: string,
  ) => {
    const found = tallies.find((row) => row.key === key);

    return `${found?.rows ?? 0} / ${(found?.amount ?? 0).toLocaleString("en-US")}`;
  };

  const check = (label: string, expected: string | number, actual: string | number = 0) => ({
    label,
    expected: `${expected}`,
    actual: `${actual}`,
  });

  const imported = (table: string) =>
    legacy.skips
      .filter((skip) => skip.table === table)
      .reduce(
        (rows, skip) => (skip.reason === "all rows" ? rows + skip.rows : rows - skip.rows),
        0,
      );

  const ascending = v2.numbers.every(
    (number, index) => index === 0 || number > v2.numbers[index - 1]!,
  );

  const checks = [
    check("customers (rows minus skipped)", imported("customers"), v2.customers),
    check(
      "customers without a valid phone",
      legacy.customers.filter((row) => row.phone === null).length,
      v2.nullPhones,
    ),
    check(
      "orders (rows minus skipped)",
      imported("orders"),
      v2.byStatus.reduce((rows, row) => rows + row.rows, 0),
    ),
    check(
      "payments (rows minus skipped)",
      imported("payments"),
      v2.byMethod.reduce((rows, row) => rows + row.rows, 0),
    ),
    ...OrderStatus.literals.map((status) =>
      check(
        `${status} orders / total ₮`,
        tally(legacy.byStatus, status),
        tally(v2.byStatus, status),
      ),
    ),
    ...PaymentMethod.literals.map((method) =>
      check(
        `${method} payments / sum ₮`,
        tally(legacy.byMethod, method),
        tally(v2.byMethod, method),
      ),
    ),
    ...OrderEventType.literals.map((type) =>
      check(
        `${type} events`,
        legacy.orders.filter((row) => type === "placed" || row.status === type).length,
        v2.byEvent.find((row) => row.key === type)?.rows,
      ),
    ),
    check("order numbers ascend with created_at", "yes", ascending ? "yes" : "no"),
  ];

  const mismatches = checks.filter(({ expected, actual }) => expected !== actual);
  const [waiting] = legacy.waiting;

  yield* Console.log(
    [
      "",
      `${"Reconciliation".padEnd(40)}${"vit-store".padStart(20)}${"v2".padStart(20)}`,
      ...checks.map(
        ({ label, expected, actual }) =>
          `  ${label.padEnd(38)}${expected.padStart(20)}${actual.padStart(20)}  ${expected === actual ? "ok" : "MISMATCH"}`,
      ),
      `  order numbers ${v2.numbers[0]} to ${v2.numbers.at(-1)}`,
      "",
      "Skipped legacy rows",
      ...legacy.skips
        .filter((skip) => skip.reason !== "all rows")
        .map((skip) => `  ${`${skip.table}: ${skip.reason}`.padEnd(58)}${skip.rows}`),
      "",
      `Waiting for the catalog: ${waiting?.rows} order lines, ${waiting?.amount} units`,
    ].join("\n"),
  );

  if (mismatches.length > 0) {
    return yield* new ReconciliationMismatch({ checks: mismatches.map(({ label }) => label) });
  }
});

const run = Effect.fn("LegacyImport.run")(function* run() {
  const source = yield* Layer.build(PgClient.layerConfig({ url: legacyUrl })).pipe(
    Effect.map(Context.get(PgClient.PgClient)),
  );

  const target = yield* Layer.build(
    Database.layer.pipe(
      Layer.provide(PgClient.layerConfig({ url: Config.Redacted("DATABASE_URL") })),
    ),
  );

  const legacy = yield* readLegacy(source);

  // A mismatch fails the transaction, so a bad import leaves nothing behind.
  yield* transaction(Effect.andThen(importAll(legacy), reconcile(legacy))).pipe(
    Effect.provide(target),
  );
});

// Script entry: imports vit-store from LEGACY_DATABASE_URL (default: `vitstore` next to DATABASE_URL) into DATABASE_URL.
await Effect.runPromise(run().pipe(Effect.scoped, dieOnDatabaseError));
