import { BankTransactionId, newId, TransferUnavailable } from "@amerik/contracts";
import type { AssignTransfer, OrderId, OrderNumber, PaymentId } from "@amerik/contracts";
import { Database, notify, schema, transaction, tugrik } from "@amerik/db";
import { and, eq, gte, isNull, lte, ne, sum } from "drizzle-orm";
import { isIncoming, KhaanAuthError, KhaanClient, KhaanRateLimitError } from "khaan-client";
import type { KhaanTransaction } from "khaan-client";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

import { lockOrder, paidSum, recordPayment } from "./orders";

// The rules behind matching: docs/COMMERCE-RULES.md, Payments.
const { bankTransactions, customers, orders, payments } = schema;

export const khaanConfig = Config.all({
  username: Config.String("KHAAN_USERNAME"),
  password: Config.Redacted("KHAAN_PASSWORD"),
  deviceId: Config.String("KHAAN_DEVICE_ID"),
  userAgent: Config.String("KHAAN_USER_AGENT"),
  accountNumber: Config.String("KHAAN_ACCOUNT_NUMBER"),
});

/**
 * - `auth`: the password changed, or the device lost its remembered login and
 *   needs an OTP. The owner logs in once with the khaan-client CLI.
 * - `rate_limit`, `network`: try again on the next run.
 */
export class KhaanUnavailable extends Data.TaggedError("KhaanUnavailable")<{
  readonly reason: "auth" | "rate_limit" | "network";
}> {}

const make = (config: Effect.Success<typeof khaanConfig>) => ({
  /** The latest ~10 transactions on the account. Read-only: nothing here moves money. */
  recent: Effect.gen(function* recent() {
    const client = new KhaanClient({ ...config, password: Redacted.value(config.password) });

    // Adapter edge: khaan-client throws its own error classes. Each becomes a reason here.
    const call = <A>(run: () => Promise<A>) =>
      Effect.tryPromise({
        try: run,
        catch: (error) =>
          new KhaanUnavailable({
            reason:
              error instanceof KhaanAuthError
                ? "auth"
                : error instanceof KhaanRateLimitError
                  ? "rate_limit"
                  : "network",
          }),
      });

    const login = yield* call(() => client.loginInitial());

    if (login.status === "mfa_required") return yield* new KhaanUnavailable({ reason: "auth" });

    return yield* call(() => client.fetchTransactions());
  }).pipe(Effect.withSpan("Khaan.recent")),
});

export class Khaan extends Context.Service<Khaan, ReturnType<typeof make>>()("amerik/Khaan") {
  static readonly layer = (config: Effect.Success<typeof khaanConfig>) =>
    Layer.succeed(Khaan, Khaan.of(make(config)));
}

/** An incoming transfer as stored. Whole tugriks; interest credits in fractions are skipped. */
const Incoming = Schema.Struct({
  tranDate: Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}/u)),
  time: Schema.optional(Schema.String),
  amount: Schema.Int.check(Schema.isGreaterThan(0)),
  description: Schema.optional(Schema.String),
  balance: Schema.optional(Schema.Number),
  relatedAccount: Schema.optional(Schema.String),
});

type Incoming = typeof Incoming.Type;

/**
 * vit-store's fingerprint, byte for byte, so a transfer it already counted
 * (imported as a payment's `provider_ref`) is recognised here.
 */
const fingerprintOf = (tx: Incoming) =>
  Effect.promise(() =>
    crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(
        [
          tx.tranDate,
          tx.time ?? "",
          String(tx.amount),
          tx.description ?? "",
          tx.relatedAccount ?? "",
          String(tx.balance ?? ""),
        ].join("|"),
      ),
    ),
  ).pipe(
    Effect.map((digest) =>
      Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""),
    ),
  );

/**
 * Khaan's `tranDate` is the Ulaanbaatar calendar date, sent as UTC midnight,
 * and `time` is UB wall-clock HH:MM. UB is UTC+8 with no DST. A missing time
 * means the end of that UB day.
 */
const happenedAt = (tx: Incoming) => {
  const time = /^(\d{2}):(\d{2})/u.exec(tx.time?.trim().padStart(5, "0") ?? "");
  const clock = time === null ? "23:59:59" : `${time[1]}:${time[2]}:00`;

  return DateTime.make(`${tx.tranDate.slice(0, 10)}T${clock}+08:00`).pipe(
    Option.map(DateTime.toDateUtc),
  );
};

/** A transfer pays an order placed up to this long before it. */
const WINDOW_DAYS = 14;

/** Bank and server clocks disagree by a few minutes. */
const SKEW_MINUTES = 10;

/** `10234` or `99112233` as a whole number in the description, not inside a longer one. */
const mentions = (description: string, digits: string) =>
  new RegExp(`(?<!\\d)${digits}(?!\\d)`, "u").test(description);

const mentionsOrder = (
  description: string,
  order: { readonly number: OrderNumber; readonly phone: string | null },
) =>
  mentions(description, String(order.number)) ||
  (order.phone !== null && mentions(description, order.phone));

type Candidate =
  | { readonly kind: "manual"; readonly orderId: OrderId; readonly paymentId: PaymentId }
  | { readonly kind: "open"; readonly orderId: OrderId };

/**
 * Orders the transfer may pay: placed in the window, mentioned in the
 * description, and either owing exactly the amount or holding a manual
 * transfer payment of exactly the amount that no bank line backs yet.
 */
const candidatesFor = Effect.fn("candidatesFor")(function* candidatesFor(transfer: {
  readonly amount: number;
  readonly description: string;
  readonly happenedAt: Date;
}) {
  const db = yield* Database;
  const at = DateTime.fromDateUnsafe(transfer.happenedAt);
  const from = DateTime.toDateUtc(DateTime.subtract(at, { days: WINDOW_DAYS }));
  const to = DateTime.toDateUtc(DateTime.add(at, { minutes: SKEW_MINUTES }));
  const placed = and(gte(orders.createdAt, from), lte(orders.createdAt, to));

  const open = yield* db
    .select({
      orderId: orders.id,
      number: orders.number,
      phone: customers.phone,
      total: orders.total,
      paid: sum(payments.amount),
    })
    .from(orders)
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .leftJoin(payments, eq(payments.orderId, orders.id))
    .where(and(placed, ne(orders.status, "cancelled")))
    .groupBy(orders.id, customers.phone);

  const manual = yield* db
    .select({
      orderId: orders.id,
      number: orders.number,
      phone: customers.phone,
      paymentId: payments.id,
    })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .where(
      and(
        placed,
        eq(payments.method, "transfer"),
        isNull(payments.providerRef),
        eq(payments.amount, transfer.amount),
      ),
    );

  const byOrder = new Map<OrderId, Candidate>();

  for (const order of open) {
    if (
      order.total - Number(order.paid ?? 0) === transfer.amount &&
      mentionsOrder(transfer.description, order)
    ) {
      byOrder.set(order.orderId, { kind: "open", orderId: order.orderId });
    }
  }

  // An order that both owes the amount and holds a manual payment of it: the
  // bank line is the manual payment's, never a second payment.
  for (const payment of manual) {
    if (mentionsOrder(transfer.description, payment)) {
      byOrder.set(payment.orderId, {
        kind: "manual",
        orderId: payment.orderId,
        paymentId: payment.paymentId,
      });
    }
  }

  return [...byOrder.values()];
});

/** Marks mom's manual payment as the one this bank line backs. False if someone got there first. */
const attach = Effect.fn("attach")(function* attach(paymentId: PaymentId, fingerprint: string) {
  const db = yield* Database;

  const [attached] = yield* db
    .update(payments)
    .set({ providerRef: fingerprint })
    .where(and(eq(payments.id, paymentId), isNull(payments.providerRef)))
    .returning({ id: payments.id });

  return attached !== undefined;
});

const link = Effect.fn("link")(function* link(transferId: BankTransactionId, paymentId: PaymentId) {
  const db = yield* Database;

  yield* db.update(bankTransactions).set({ paymentId }).where(eq(bankTransactions.id, transferId));
});

/** Pays the one candidate. False when the order changed under us, which sends it to the inbox. */
const apply = Effect.fn("apply")(function* apply(
  transfer: {
    readonly id: BankTransactionId;
    readonly fingerprint: string;
    readonly amount: number;
  },
  candidate: Candidate,
) {
  const order = yield* lockOrder(candidate.orderId);

  if (candidate.kind === "manual") {
    if (!(yield* attach(candidate.paymentId, transfer.fingerprint))) return false;

    yield* link(transfer.id, candidate.paymentId);

    return true;
  }

  // Re-read the balance under the lock: mom may have recorded a payment since the match.
  if (order.total - (yield* paidSum(order.id)) !== transfer.amount) return false;

  const { paymentId } = yield* recordPayment(
    {
      orderId: order.id,
      amount: transfer.amount,
      method: "transfer",
      providerRef: transfer.fingerprint,
    },
    "khaan",
  );

  yield* link(transfer.id, paymentId);

  return true;
});

/**
 * Stores one incoming transfer, once per fingerprint, and pays the one order
 * it fits. Zero fits, two fits, or a changed order leave it unmatched and ping
 * the admin chat.
 */
const storeTransfer = Effect.fn("storeTransfer")(function* storeTransfer(tx: Incoming) {
  const db = yield* Database;
  const fingerprint = yield* fingerprintOf(tx);
  const at = happenedAt(tx);

  if (Option.isNone(at)) return yield* Effect.die(`storeTransfer: unreadable date ${tx.tranDate}`);

  const [transfer] = yield* db
    .insert(bankTransactions)
    .values({
      id: yield* newId(BankTransactionId),
      fingerprint,
      amount: tx.amount,
      description: tx.description ?? "",
      account: tx.relatedAccount === "" ? undefined : tx.relatedAccount,
      happenedAt: at.value,
      createdAt: DateTime.toDateUtc(yield* DateTime.now),
    })
    .onConflictDoNothing({ target: bankTransactions.fingerprint })
    .returning();

  if (transfer === undefined) return "seen" as const;

  // Counted before this table existed: vit-store's import keeps the fingerprint as provider_ref.
  const [counted] = yield* db
    .select({ id: payments.id })
    .from(payments)
    .where(eq(payments.providerRef, fingerprint));

  if (counted !== undefined) {
    yield* link(transfer.id, counted.id);

    return "counted" as const;
  }

  const candidates = yield* candidatesFor(transfer);
  const [only] = candidates;

  if (candidates.length === 1 && only !== undefined && (yield* apply(transfer, only))) {
    return "matched" as const;
  }

  yield* notify(
    "unmatched_transfer",
    `${candidates.length > 1 ? "Хэд хэдэн захиалгад тохирсон" : "Захиалгад тохироогүй"} шилжүүлэг: ${tugrik(transfer.amount)}, "${transfer.description}"`,
  );

  return "unmatched" as const;
}, transaction);

/** Fetches the latest Khaan transactions and stores each new incoming one. Safe to run any time. */
export const syncKhaan = Effect.fn("syncKhaan")(function* syncKhaan() {
  const khaan = yield* Khaan;
  const recent: ReadonlyArray<KhaanTransaction> = yield* khaan.recent;
  const outcomes = { seen: 0, counted: 0, matched: 0, unmatched: 0, skipped: 0 };

  const incoming = yield* Effect.forEach(recent.filter(isIncoming), (tx) =>
    Schema.decodeUnknownEffect(Incoming)(tx).pipe(
      Effect.tapError((error) =>
        Effect.logWarning("khaan transfer skipped", { error: error.message }),
      ),
      Effect.option,
    ),
  );

  // Oldest first, so two transfers for one order pay it in the order they came.
  const ordered = incoming
    .flatMap((tx) => (Option.isSome(tx) ? [tx.value] : []))
    .toSorted((a, b) =>
      `${a.tranDate}${a.time ?? ""}`.localeCompare(`${b.tranDate}${b.time ?? ""}`),
    );

  outcomes.skipped = incoming.length - ordered.length;

  for (const tx of ordered) {
    outcomes[yield* storeTransfer(tx)] += 1;
  }

  return outcomes;
});

/**
 * Mom gives an unmatched transfer to an order by hand. It backs her manual
 * transfer payment of the same amount if the order has one, else it becomes a
 * new `transfer` payment for whatever it was, short or over.
 */
export const assignTransfer = Effect.fn("assignTransfer")(function* assignTransfer(
  input: AssignTransfer,
  actor: string,
) {
  const db = yield* Database;

  const [transfer] = yield* db
    .select()
    .from(bankTransactions)
    .where(eq(bankTransactions.id, input.transferId))
    .for("update");

  if (transfer === undefined || transfer.paymentId !== null) {
    return yield* new TransferUnavailable({ transferId: input.transferId });
  }

  const order = yield* lockOrder(input.orderId);

  const [manual] = yield* db
    .select({ id: payments.id })
    .from(payments)
    .where(
      and(
        eq(payments.orderId, order.id),
        eq(payments.method, "transfer"),
        isNull(payments.providerRef),
        eq(payments.amount, transfer.amount),
      ),
    )
    .limit(1);

  if (manual !== undefined && (yield* attach(manual.id, transfer.fingerprint))) {
    yield* link(transfer.id, manual.id);

    return { paymentId: manual.id, status: order.status };
  }

  const recorded = yield* recordPayment(
    {
      orderId: order.id,
      amount: transfer.amount,
      method: "transfer",
      providerRef: transfer.fingerprint,
    },
    actor,
  );

  yield* link(transfer.id, recorded.paymentId);

  return recorded;
}, transaction);
