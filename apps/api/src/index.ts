import { Api } from "@amerik/contracts";
import { Database } from "@amerik/db";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Drizzle from "alchemy/Drizzle/Postgres";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/http";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import * as RpcServer from "effect/rpc/RpcServer";

import { Postgres } from "../infra/database";
import { apiDomain, apiHostname } from "../infra/domain";
import { pingDatabase } from "./health";
import { Khaan, khaanConfig, syncKhaan } from "./khaan";
import { dispatchOutbox, Telegram, telegramConfig } from "./outbox";
import { QPay, QPayCallbackUrl, qpayCallback, qpayConfig, sweepQPayInvoices } from "./qpay";
import { ApiHandlers, HideDefectsLive } from "./rpc";
import { ApiWorker } from "./worker";

export default ApiWorker.make(
  apiDomain.pipe(
    Effect.map((domain) => ({
      compatibility: { date: "2026-09-08", flags: ["nodejs_compat"] },
      dev: { port: 8788, strictPort: true },
      domain,
      main: import.meta.url,
    })),
  ),
  Effect.gen(function* impl() {
    // This effect also runs at deploy time, when no binding exists. The
    // Drizzle handle connects on the first query and closes with the request.
    const hyperdrive = yield* Cloudflare.Hyperdrive.Connect(yield* Postgres);
    const database = Layer.succeed(Database, yield* Drizzle.Postgres(hyperdrive.connectionString));

    // Config read here is bound to the Worker as a secret at deploy time.
    // The QPay and Telegram layers are built per request or cron run, so a
    // QPay token never outlives one.
    const services = Layer.mergeAll(
      database,
      QPay.layer(yield* qpayConfig),
      Layer.succeed(QPayCallbackUrl, `https://${apiHostname}/qpay/callback`),
      Khaan.layer(yield* khaanConfig),
      Telegram.layer(yield* telegramConfig),
    );

    const logFailure = (job: string) =>
      Effect.catchCause((cause) => Effect.logError(`${job} failed`, cause));

    // Its own scope, so the run opens its own connection instead of reusing
    // one the request is about to close.
    const dispatch = Effect.scoped(dispatchOutbox()).pipe(
      Effect.provide(services),
      logFailure("outbox dispatch"),
    );

    // vit-store's cadence. Each job logs its own failure, so one never stops
    // the next, and the dispatcher sends what the first two queued.
    yield* Cloudflare.Workers.cron("*/5 * * * *", () =>
      Effect.all(
        [
          syncKhaan().pipe(
            Effect.tap((outcomes) => Effect.log("khaan sync", outcomes)),
            Effect.provide(services),
            logFailure("khaan sync"),
          ),
          sweepQPayInvoices().pipe(Effect.provide(services), logFailure("qpay sweep")),
          dispatch,
        ],
        { discard: true },
      ),
    );

    const health = pingDatabase.pipe(
      Effect.as(HttpServerResponse.jsonUnsafe({ ok: true })),
      Effect.catch(() =>
        Effect.succeed(HttpServerResponse.jsonUnsafe({ ok: false }, { status: 503 })),
      ),
    );

    const routes = Layer.mergeAll(
      HttpRouter.add(
        "POST",
        "/rpc",
        Effect.flatten(RpcServer.toHttpEffect(Api)).pipe(
          Effect.provide(
            Layer.mergeAll(
              ApiHandlers.pipe(Layer.provide(database)),
              HideDefectsLive,
              RpcSerialization.layerJson,
            ),
          ),
        ),
      ),
      HttpRouter.add("GET", "/health", health.pipe(Effect.provide(database))),
      // A paid order queues an outbox row. The request scope closes through
      // waitUntil after the response is sent, so the row goes out then.
      HttpRouter.add(
        "*",
        "/qpay/callback",
        Effect.addFinalizer(() => dispatch).pipe(
          Effect.andThen(qpayCallback),
          Effect.provide(services),
        ),
      ),
    );

    return {
      fetch: yield* routes.pipe(Layer.provide(HttpServer.layerServices), HttpRouter.toHttpEffect),
    };
  }).pipe(
    Effect.provide(
      Layer.mergeAll(Cloudflare.Hyperdrive.ConnectBinding, Cloudflare.Workers.CronEventSourceLive),
    ),
  ),
);
