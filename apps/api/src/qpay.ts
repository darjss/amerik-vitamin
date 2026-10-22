import {
  NothingOwed,
  OrderId,
  OrderNotFound,
  QPayInvoiceId,
  QPayUnavailable,
  WrongOrderStatus,
} from "@amerik/contracts";
import { Database, dieOnDatabaseError, schema } from "@amerik/db";
import { eq, gt } from "drizzle-orm";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/http";

import { owed, recordPayment } from "./orders";

const { orders, qpayInvoices } = schema;

/** QPay's merchant API v2. Every response is decoded; the callback body is never read. */
export const qpayConfig = Config.all({
  url: Config.String("QPAY_URL"),
  username: Config.String("QPAY_USERNAME"),
  password: Config.Redacted("QPAY_PASSWORD"),
});

const Token = Schema.Struct({ access_token: Schema.String });

const Invoice = Schema.Struct({
  invoice_id: QPayInvoiceId,
  qr_text: Schema.String,
  qr_image: Schema.String,
  qPay_shortUrl: Schema.String,
  urls: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      description: Schema.String,
      logo: Schema.String,
      link: Schema.String,
    }),
  ),
});

/** Amounts arrive as decimal strings, "125000.00". Money here is whole tugriks. */
const Amount = Schema.NumberFromString.check(Schema.isInt());

const PaymentCheck = Schema.Struct({
  count: Schema.Number,
  rows: Schema.Array(
    Schema.Struct({
      payment_id: Schema.NonEmptyString,
      payment_status: Schema.String,
      payment_amount: Amount,
      payment_currency: Schema.String,
    }),
  ),
});

/** vit-store's merchant settings, registered with QPay. */
const INVOICE_CODE = "AMERIK_VITAMIN_INVOICE";

/**
 * `callbackUrl` is where QPay reports a payment: the stage's own API origin,
 * so a dev stage never sends callbacks to production.
 */
const make = Effect.fn("QPay.make")(function* make(
  config: Effect.Success<typeof qpayConfig>,
  callbackUrl: string,
) {
  const base = config.url.endsWith("/") ? config.url : `${config.url}/`;

  const http = (yield* HttpClient.HttpClient).pipe(
    HttpClient.retryTransient({ schedule: Schedule.exponential("500 millis"), times: 2 }),
    HttpClient.filterStatusOk,
  );

  /** One POST: status checked, body decoded. The cause is logged here and never leaves. */
  const post = <A, I>(
    operation: string,
    path: string,
    output: Schema.Codec<A, I>,
    request: (request: HttpClientRequest.HttpClientRequest) => HttpClientRequest.HttpClientRequest,
  ) =>
    http.execute(request(HttpClientRequest.post(`${base}${path}`))).pipe(
      Effect.flatMap(HttpClientResponse.schemaBodyJson(output)),
      // QPay says why it refused in the body.
      Effect.catchReason("HttpClientError", "StatusCodeError", ({ response }, error) =>
        response.text.pipe(
          Effect.flatMap((body) =>
            Effect.logError("qpay refused", { operation, body: body.slice(0, 300) }),
          ),
          Effect.ignore({ log: true }),
          Effect.andThen(Effect.fail(error)),
        ),
      ),
      Effect.timeout("15 seconds"),
      Effect.tapError((cause) => Effect.logError("qpay request failed", { operation, cause })),
      Effect.mapError(() => new QPayUnavailable()),
      Effect.withSpan(`QPay.${operation}`),
    );

  // A token lives as long as this layer: one request or one cron run, far
  // inside its expiry, so a stale token never reaches QPay.
  const token = yield* Effect.cached(
    post(
      "token",
      "auth/token",
      Token,
      HttpClientRequest.basicAuth(config.username, config.password),
    ).pipe(Effect.map((body) => body.access_token)),
  );

  const authed = <A, I>(
    operation: string,
    path: string,
    output: Schema.Codec<A, I>,
    body: Schema.Json,
  ) =>
    Effect.flatMap(token, (accessToken) =>
      post(operation, path, output, (request) =>
        request.pipe(
          HttpClientRequest.bearerToken(accessToken),
          HttpClientRequest.bodyJsonUnsafe(body),
        ),
      ),
    );

  return {
    /** The order id in the callback URL lets the callback find the invoices to re-check. */
    createInvoice: (input: {
      readonly orderId: OrderId;
      readonly senderInvoiceNo: string;
      readonly amount: number;
      readonly description: string;
    }) =>
      authed("createInvoice", "invoice", Invoice, {
        invoice_code: INVOICE_CODE,
        sender_invoice_no: input.senderInvoiceNo,
        invoice_receiver_code: "terminal",
        sender_branch_code: "SALBAR1",
        invoice_description: input.description,
        amount: input.amount,
        callback_url: `${callbackUrl}?order=${input.orderId}`,
      }),

    checkInvoice: (invoiceId: QPayInvoiceId) =>
      authed("checkInvoice", "payment/check", PaymentCheck, {
        object_type: "INVOICE",
        object_id: invoiceId,
        offset: { page_number: 1, page_limit: 100 },
      }),
  };
});

export class QPay extends Context.Service<QPay, Effect.Success<ReturnType<typeof make>>>()(
  "amerik/QPay",
) {
  /** Built per request or cron run, so the token cache never outlives it. */
  static readonly layer = (config: Effect.Success<typeof qpayConfig>, callbackUrl: string) =>
    Layer.effect(QPay, make(config, callbackUrl)).pipe(Layer.provide(FetchHttpClient.layer));
}

/**
 * A QPay invoice for what the order still owes. A cancelled order can't be
 * invoiced. Creating a second invoice is harmless: each one is re-checked.
 */
export const createQPayInvoice = Effect.fn("createQPayInvoice")(function* createQPayInvoice(
  orderId: OrderId,
) {
  const db = yield* Database;
  const qpay = yield* QPay;

  const [order] = yield* db.select().from(orders).where(eq(orders.id, orderId));

  if (order === undefined) return yield* new OrderNotFound({ orderId });

  if (order.status === "cancelled") {
    return yield* new WrongOrderStatus({ orderId, status: order.status });
  }

  const amount = yield* owed(order);

  if (amount <= 0) return yield* new NothingOwed({ orderId });

  const createdAt = DateTime.toDateUtc(yield* DateTime.now);

  const invoice = yield* qpay.createInvoice({
    orderId: order.id,
    senderInvoiceNo: `${order.number}-${createdAt.getTime()}`,
    amount,
    description: `Amerik Vitamin #${order.number}`,
  });

  yield* db.insert(qpayInvoices).values({ id: invoice.invoice_id, orderId, amount, createdAt });

  return {
    invoiceId: invoice.invoice_id,
    amount,
    qrText: invoice.qr_text,
    qrImage: invoice.qr_image,
    shortUrl: invoice.qPay_shortUrl,
    urls: invoice.urls,
  };
}, dieOnDatabaseError);

/**
 * Asks QPay about every invoice of the order and records each PAID payment
 * with its QPay payment id, for the amount QPay says was paid. A payment
 * already recorded is a no-op, so a replayed callback changes nothing.
 */
export const checkQPayInvoices = Effect.fn("checkQPayInvoices")(function* checkQPayInvoices(
  orderId: OrderId,
) {
  const db = yield* Database;
  const qpay = yield* QPay;

  const invoices = yield* db
    .select({ id: qpayInvoices.id })
    .from(qpayInvoices)
    .where(eq(qpayInvoices.orderId, orderId));

  const checks = yield* Effect.forEach(invoices, (invoice) => qpay.checkInvoice(invoice.id));
  const paid = checks.flatMap((check) => check.rows).filter((row) => row.payment_status === "PAID");

  yield* Effect.forEach(
    paid,
    (row) =>
      recordPayment(
        { orderId, amount: row.payment_amount, method: "qpay", providerRef: row.payment_id },
        "qpay",
      ).pipe(
        // The same QPay payment id on another order or for another amount: a human looks.
        Effect.catchTag("PaymentConflict", (error) =>
          Effect.logError("qpay payment conflicts with a recorded one", {
            providerRef: error.providerRef,
            orderId,
          }),
        ),
        // The invoice row's foreign key keeps the order, and a QPay payment is positive.
        Effect.catchTags({ OrderNotFound: Effect.die, RefundExceedsPaid: Effect.die }),
      ),
    { discard: true },
  );

  return { invoices: invoices.length, paid: paid.length };
}, dieOnDatabaseError);

/** Invoices younger than this get re-checked by the cron, in case a callback never came. */
const SWEEP_WINDOW_HOURS = 2;

/** Re-checks recent invoices on orders that still owe money. Covers a lost or early callback. */
export const sweepQPayInvoices = Effect.fn("sweepQPayInvoices")(function* sweepQPayInvoices() {
  const db = yield* Database;

  const since = DateTime.toDateUtc(
    DateTime.subtract(yield* DateTime.now, { hours: SWEEP_WINDOW_HOURS }),
  );

  const recent = yield* db
    .selectDistinct({ id: orders.id, total: orders.total })
    .from(qpayInvoices)
    .innerJoin(orders, eq(orders.id, qpayInvoices.orderId))
    .where(gt(qpayInvoices.createdAt, since));

  yield* Effect.forEach(
    recent,
    (order) =>
      checkQPayInvoices(order.id).pipe(Effect.when(Effect.map(owed(order), (due) => due > 0))),
    { discard: true },
  );
}, dieOnDatabaseError);

/**
 * QPay calls `callback_url` when an invoice is paid. Its body is ignored:
 * the order id in our own URL says which invoices to re-check with QPay.
 * QPay down answers 503, and the sweep tries again within five minutes.
 */
export const qpayCallback = HttpServerRequest.schemaSearchParams(
  Schema.Struct({ order: OrderId }),
).pipe(
  Effect.flatMap(({ order }) => checkQPayInvoices(order)),
  Effect.map((checked) => HttpServerResponse.jsonUnsafe({ ok: true, ...checked })),
  Effect.catchTags({
    SchemaError: () =>
      Effect.succeed(HttpServerResponse.jsonUnsafe({ ok: false }, { status: 400 })),
    QPayUnavailable: () =>
      Effect.succeed(HttpServerResponse.jsonUnsafe({ ok: false }, { status: 503 })),
  }),
  Effect.withSpan("qpayCallback"),
);
