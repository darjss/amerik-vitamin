import { DatabaseUnavailable } from "@amerik/contracts";
import { ping } from "@amerik/db";
import * as Effect from "effect/Effect";

/** One round trip through Hyperdrive to Postgres. Connection failures arrive as defects, so catch the whole cause. */
export const pingDatabase = ping.pipe(
  Effect.catchCause(() => Effect.fail(new DatabaseUnavailable())),
);
