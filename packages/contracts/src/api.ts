import * as Schema from "effect/Schema";
import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";

export class DatabaseUnavailable extends Schema.TaggedError<DatabaseUnavailable>()(
  "DatabaseUnavailable",
  {},
) {}

export class Api extends RpcGroup.make(
  Rpc.make("health", {
    error: DatabaseUnavailable,
    success: Schema.Struct({ database: Schema.Literal("ok") }),
  }),
) {}
