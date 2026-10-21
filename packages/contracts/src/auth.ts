import * as Context from "effect/Context";
import * as Schema from "effect/Schema";
import * as RpcMiddleware from "effect/rpc/RpcMiddleware";

/** The admin behind a dashboard call. Every write records `email` as its actor. */
export class CurrentUser extends Context.Service<CurrentUser, { readonly email: string }>()(
  "amerik/CurrentUser",
) {}

/** No session, an expired one, or an email no longer on the allowlist. The UI shows sign-in. */
export class Unauthorized extends Schema.TaggedError<Unauthorized>()("Unauthorized", {}) {}

/** Turns the session cookie into a `CurrentUser`. Every dashboard rpc carries it; `health` does not. */
export class Authenticated extends RpcMiddleware.Service<
  Authenticated,
  { provides: CurrentUser }
>()("amerik/Authenticated", { error: Unauthorized }) {}
