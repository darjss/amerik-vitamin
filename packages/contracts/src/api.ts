import * as Schema from "effect/Schema";
import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as RpcMiddleware from "effect/rpc/RpcMiddleware";

export class DatabaseUnavailable extends Schema.TaggedError<DatabaseUnavailable>()(
  "DatabaseUnavailable",
  {},
) {}

/**
 * Server side only. `RpcServer` sends a defect to the client with its message,
 * so every RPC dies with a bare "internal error" and the server logs the real one.
 */
export class HideDefects extends RpcMiddleware.Service<HideDefects>()("amerik/HideDefects") {}

export class Api extends RpcGroup.make(
  Rpc.make("health", {
    error: DatabaseUnavailable,
    success: Schema.Struct({ database: Schema.Literal("ok") }),
  }),
).middleware(HideDefects) {}
