import {
  BatchNotFound,
  newId,
  NothingOpen,
  priceFromAmazon,
  SupplierOrderId,
} from "@amerik/contracts";
import type { BatchStatus, CloseBatch, ReceiveBatch, SupplierOrderInput } from "@amerik/contracts";
import { Database, dieOnDatabaseError, moveStock, schema, transaction } from "@amerik/db";
import { and, asc, between, eq, inArray, isNull, lt, lte } from "drizzle-orm";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";

const { products, supplierOrderLines, supplierOrders } = schema;

/**
 * Adds or refreshes supplier orders, matched on Amazon's order number, so a
 * replay changes nothing. A line gets its product from `products.asin`.
 * A known total or cost is never overwritten with an unknown one.
 */
export const importSupplierOrders = Effect.fn("importSupplierOrders")(
  function* importSupplierOrders(orders: ReadonlyArray<SupplierOrderInput>) {
    const db = yield* Database;

    const asins = [...new Set(orders.flatMap((order) => order.items.map((item) => item.asin)))];

    const known = yield* db
      .select({ id: products.id, asin: products.asin })
      .from(products)
      .where(inArray(products.asin, asins));

    const productOf = new Map(known.map((product) => [product.asin, product.id]));

    for (const order of orders) {
      // A scraper bug once turned missing totals into $0, so 0 is unknown too.
      const totalCents = order.totalCents === 0 ? null : order.totalCents;

      // Amazon lists a product twice when it ships in two parcels.
      const lines = new Map<string, { title: string; qty: number }>();

      for (const item of order.items) {
        lines.set(item.asin, {
          title: item.title,
          qty: (lines.get(item.asin)?.qty ?? 0) + item.qty,
        });
      }

      const [only, ...others] = lines.values();

      const unitCostCents =
        only !== undefined && others.length === 0 && totalCents !== null
          ? Math.round(totalCents / only.qty)
          : null;

      const orderUpdate: Partial<typeof supplierOrders.$inferInsert> = {
        orderedOn: order.orderedOn,
      };

      if (totalCents !== null) orderUpdate.totalCents = totalCents;

      const [row] = yield* db
        .insert(supplierOrders)
        .values({
          id: yield* newId(SupplierOrderId),
          number: order.number,
          orderedOn: order.orderedOn,
          totalCents,
        })
        .onConflictDoUpdate({ target: supplierOrders.number, set: orderUpdate })
        .returning({ id: supplierOrders.id });

      if (row === undefined) return yield* Effect.die(`importSupplierOrders: ${order.number}`);

      for (const [asin, line] of lines) {
        const productId = productOf.get(asin) ?? null;

        const lineUpdate: Partial<typeof supplierOrderLines.$inferInsert> = { ...line };

        if (unitCostCents !== null) lineUpdate.unitCostCents = unitCostCents;

        if (productId !== null) lineUpdate.productId = productId;

        yield* db
          .insert(supplierOrderLines)
          .values({ orderId: row.id, asin, ...line, unitCostCents, productId })
          .onConflictDoUpdate({
            target: [supplierOrderLines.orderId, supplierOrderLines.asin],
            set: lineUpdate,
          });
      }
    }
  },
  transaction,
);

/** A gap of more than this between two order days starts a new batch. */
const BATCH_GAP = Duration.days(2);

/** Groups order days, sorted oldest first, into batches in the same order. */
const batchesOf = (days: ReadonlyArray<string>) => {
  const batches: Array<{ from: string; to: string }> = [];

  for (const day of days) {
    const last = batches.at(-1);

    if (
      last === undefined ||
      Duration.isGreaterThan(
        DateTime.distance(DateTime.makeUnsafe(last.to), DateTime.makeUnsafe(day)),
        BATCH_GAP,
      )
    ) {
      batches.push({ from: day, to: day });
    } else {
      last.to = day;
    }
  }

  return batches;
};

/** Units still coming on a line. A closed line has none. */
const openUnits = (line: { qty: number; received: number; closedAt: Date | null }) =>
  line.closedAt === null ? line.qty - line.received : 0;

/** The batch that starts on `batch`. */
const findBatch = Effect.fn("findBatch")(function* findBatch(batch: string) {
  const db = yield* Database;

  const days = yield* db
    .selectDistinct({ day: supplierOrders.orderedOn })
    .from(supplierOrders)
    .orderBy(asc(supplierOrders.orderedOn))
    .pipe(dieOnDatabaseError);

  const found = batchesOf(days.map((row) => row.day)).find((range) => range.from === batch);

  if (found === undefined) return yield* new BatchNotFound({ batch });

  return found;
});

/** Every batch, newest first, with its units ordered, received and still open. */
export const listBatches = Effect.fn("listBatches")(function* listBatches() {
  const db = yield* Database;

  const lines = yield* db
    .select({
      day: supplierOrders.orderedOn,
      productId: supplierOrderLines.productId,
      asin: supplierOrderLines.asin,
      qty: supplierOrderLines.qty,
      received: supplierOrderLines.received,
      closedAt: supplierOrderLines.closedAt,
    })
    .from(supplierOrderLines)
    .innerJoin(supplierOrders, eq(supplierOrders.id, supplierOrderLines.orderId))
    .orderBy(asc(supplierOrders.orderedOn))
    .pipe(dieOnDatabaseError);

  return batchesOf([...new Set(lines.map((line) => line.day))])
    .toReversed()
    .map(({ from, to }) => {
      const inBatch = lines.filter((line) => line.day >= from && line.day <= to);
      const ordered = inBatch.reduce((total, line) => total + line.qty, 0);
      const received = inBatch.reduce((total, line) => total + line.received, 0);
      const open = inBatch.reduce((total, line) => total + openUnits(line), 0);

      const status: BatchStatus =
        open === 0 ? "arrived" : received === 0 ? "ordered" : "partly_arrived";

      return {
        from,
        to,
        products: new Set(inBatch.map((line) => line.productId ?? line.asin)).size,
        ordered,
        received,
        open,
        status,
      };
    });
});

/** A batch's lines by product, for the arrival-day count. */
export const getBatch = Effect.fn("getBatch")(function* getBatch(batch: string) {
  const db = yield* Database;
  const { from, to } = yield* findBatch(batch);

  const lines = yield* db
    .select({
      asin: supplierOrderLines.asin,
      title: supplierOrderLines.title,
      qty: supplierOrderLines.qty,
      received: supplierOrderLines.received,
      closedAt: supplierOrderLines.closedAt,
      unitCostCents: supplierOrderLines.unitCostCents,
      product: {
        id: products.id,
        name: products.name,
        nameMn: products.nameMn,
        images: products.images,
        price: products.price,
      },
    })
    .from(supplierOrderLines)
    .innerJoin(supplierOrders, eq(supplierOrders.id, supplierOrderLines.orderId))
    .leftJoin(products, eq(products.id, supplierOrderLines.productId))
    .where(between(supplierOrders.orderedOn, from, to))
    .orderBy(asc(supplierOrders.orderedOn), asc(supplierOrders.number))
    .pipe(dieOnDatabaseError);

  const grouped = Map.groupBy(lines, (line) => line.product?.id ?? line.asin).values();

  return {
    from,
    to,
    products: [...grouped].map((group) => {
      const [{ product, asin, title }] = group;
      const cost = group.findLast((line) => line.unitCostCents !== null)?.unitCostCents ?? null;

      return {
        product:
          product === null
            ? null
            : {
                id: product.id,
                name: product.name,
                nameMn: product.nameMn,
                image: product.images[0] ?? null,
              },
        asin,
        title,
        expected: group.reduce((total, line) => total + openUnits(line), 0),
        received: group.reduce((total, line) => total + line.received, 0),
        suggestedPrice: product?.price ?? (cost === null ? null : priceFromAmazon(cost)),
      };
    }),
  };
});

/**
 * Boxes mix batches, so a count fills this batch's open lines oldest first,
 * then older batches', and stops at what's open. The filled count goes into
 * stock as one receipt. Cost stays unset: landed cost needs the shipment's
 * shipping and the order's FX, which nothing records yet (COMMERCE-RULES).
 */
export const receiveBatch = Effect.fn("receiveBatch")(function* receiveBatch(
  input: ReceiveBatch,
  actor: string,
) {
  const db = yield* Database;
  const { from, to } = yield* findBatch(input.batch);

  const open = yield* db
    .select({
      orderId: supplierOrderLines.orderId,
      asin: supplierOrderLines.asin,
      qty: supplierOrderLines.qty,
      received: supplierOrderLines.received,
      day: supplierOrders.orderedOn,
    })
    .from(supplierOrderLines)
    .innerJoin(supplierOrders, eq(supplierOrders.id, supplierOrderLines.orderId))
    .where(
      and(
        eq(supplierOrderLines.productId, input.productId),
        isNull(supplierOrderLines.closedAt),
        lt(supplierOrderLines.received, supplierOrderLines.qty),
        lte(supplierOrders.orderedOn, to),
      ),
    )
    .orderBy(asc(supplierOrders.orderedOn), asc(supplierOrders.number))
    .for("update", { of: supplierOrderLines });

  let left = input.received;

  for (const line of [
    ...open.filter((line) => line.day >= from),
    ...open.filter((line) => line.day < from),
  ]) {
    if (left === 0) break;

    const take = Math.min(left, line.qty - line.received);
    left -= take;

    yield* db
      .update(supplierOrderLines)
      .set({ received: line.received + take })
      .where(
        and(eq(supplierOrderLines.orderId, line.orderId), eq(supplierOrderLines.asin, line.asin)),
      );
  }

  const received = input.received - left;

  if (received === 0) return yield* new NothingOpen({ productId: input.productId });

  const moved = yield* moveStock({
    productId: input.productId,
    change: received,
    reason: "receipt",
    note: `Amazon ${from}`,
    actor,
  });

  return { received, stock: moved.stock ?? received };
}, transaction);

/** Marks what's still open of a product in a batch as not coming. */
export const closeBatch = Effect.fn("closeBatch")(function* closeBatch(input: CloseBatch) {
  const db = yield* Database;
  const { from, to } = yield* findBatch(input.batch);
  const now = DateTime.toDateUtc(yield* DateTime.now);

  const closed = yield* db
    .update(supplierOrderLines)
    .set({ closedAt: now })
    .where(
      and(
        eq(supplierOrderLines.productId, input.productId),
        isNull(supplierOrderLines.closedAt),
        lt(supplierOrderLines.received, supplierOrderLines.qty),
        inArray(
          supplierOrderLines.orderId,
          db
            .select({ id: supplierOrders.id })
            .from(supplierOrders)
            .where(between(supplierOrders.orderedOn, from, to)),
        ),
      ),
    )
    .returning({ asin: supplierOrderLines.asin })
    .pipe(dieOnDatabaseError);

  if (closed.length === 0) return yield* new NothingOpen({ productId: input.productId });
});
