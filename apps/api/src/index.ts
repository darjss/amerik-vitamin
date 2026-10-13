import { Api } from "@amerik/contracts";
import { Database } from "@amerik/db";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Drizzle from "alchemy/Drizzle/Postgres";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/http";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import * as RpcServer from "effect/rpc/RpcServer";

import { pingDatabase } from "./implementation/health";
import { ApiHandlers } from "./implementation/rpc";
import { Postgres } from "./infrastructure/database";
import { ApiWorker } from "./worker";

export default ApiWorker.make(
  {
    compatibility: { date: "2026-09-08", flags: ["nodejs_compat"] },
    dev: { port: 8788, strictPort: true },
    main: import.meta.url,
  },
  Effect.gen(function* impl() {
    // This effect also runs at deploy time, when no binding exists. The
    // Drizzle handle connects on the first query and closes with the request.
    const hyperdrive = yield* Cloudflare.Hyperdrive.Connect(yield* Postgres);
    const database = Layer.succeed(Database, yield* Drizzle.Postgres(hyperdrive.connectionString));

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
            Layer.mergeAll(ApiHandlers.pipe(Layer.provide(database)), RpcSerialization.layerJson),
          ),
        ),
      ),
      HttpRouter.add("GET", "/health", health.pipe(Effect.provide(database))),
    );
    return {
      fetch: yield* routes.pipe(Layer.provide(HttpServer.layerServices), HttpRouter.toHttpEffect),
    };
  }).pipe(Effect.provide(Cloudflare.Hyperdrive.ConnectBinding)),
);
