# Code boundaries

Use the directory tree as the file inventory. Add a package only for a real boundary, not as a generic home for helpers. The layout follows tranzfer2 for the workspace and executor (`apps/hosted/cloud`) for the API's inner split.

## Packages

- `packages/contracts` (`@amerik/contracts`) owns the wire API: schemas, branded ids, tagged errors and the `Api` RPC group. Errors carry data, not copy; the UI owns the words. Lint stops it importing database code, Alchemy or `cloudflare:*`. Today it holds `Api`: the public `health` rpc plus the dashboard's order, customer, product and stock rpcs, which sit behind the `Authenticated` middleware from `auth.ts`. Beside it are `DatabaseUnavailable`, the order and stock payloads and errors in `order.ts` and `product.ts`, and in `ids.ts` a branded UUIDv7 per table plus the branded `OrderNumber`. better-auth makes its own ids, so `UserId` is a UUIDv4. `yield* newId(OrderId)` makes a fresh id for an insert. A new table gets its id there, stored in a Postgres `uuid` column. Ids come from Effect's `Model.UuidV7WithGenerate`: a struct field generates one when `makeEffect` gets none, timed by `Clock`. The brand is type-only, so code that takes an id from outside (a URL, a webhook) decodes it with the schema for the kind it expects.
- `packages/db` (`@amerik/db`) owns the Postgres schema, migrations, `Database`, `transaction`, the named queries that need raw SQL (`moveStock`, `customerByPhone`, and the outbox's `notify`, `claimOutbox`, `markSent` and `markFailed`), and in `auth.ts` better-auth's tables and the Promise drizzle its adapter runs on. A write that should ping Telegram calls `notify` inside its transaction. `Database` is drizzle's Effect Postgres driver (`drizzle-orm/effect-postgres`) over `@effect/sql-pg`. Every table is declared with the `shop` schema from `schema.ts`; `drizzle.config.ts` sets `schemaFilter: ["shop"]` so drizzle-kit never touches vit-store's tables. `src/migrate.ts` applies `migrations/` to `DATABASE_URL`, and keeps its journal in `shop.migrations`.
- `apps/api` (`@amerik/api`) is the API Worker.
  - `src` owns the rules and the RPC handlers, flat, one file per domain. `rpc.ts` is transport only: read the caller, call a service. `health.ts` is the database probe both `/health` and the `health` rpc use.
  - An outside API is a service in its domain file, built from `Config` with a `layer`, calling out through `HttpClient` and decoding every answer with Schema: `QPay` in `qpay.ts`, `Telegram` in `outbox.ts`. `Khaan` in `khaan.ts` wraps the owner's `khaan-client`. Each file also holds that domain's operations: `createQPayInvoice`, `checkQPayInvoices` and the `/qpay/callback` handler; `syncKhaan` and `assignTransfer`; `dispatchOutbox`. They are functions, off the RPC until dashboard auth lands. (PR #8)
  - `infra` owns everything Cloudflare or Alchemy: the Hyperdrive resource in `database.ts`, the stage check in `stage.ts` and the production hostname `api-v2.amerikvitamin.mn` in `domain.ts`. Stage checks live here and nowhere else. Lint stops `infra` importing from `src`.
  - `src/index.ts` is the composition edge and `src/worker.ts` is the deploy-time identifier. `index.ts` reads every secret with `Config` during init, which binds it to the Worker at deploy, and builds the service layers per request or cron run. It registers the 5-minute cron (Khaan sync, QPay sweep, outbox dispatch) with `Cloudflare.Workers.cron`. (PR #8)
- `apps/web` (`@amerik/web`) is the Solid start app. `src/routes` owns page and HTTP route entry points, including the `/rpc` proxy to the API binding. `src/api` owns the RPC clients and the Solid bridge. Keep feature state beside its consumers.
- `infra` (`@amerik/infra`) holds `alchemy.run.ts`, which composes the stack `amerik-vitamin`: the API Worker, the web Worker, and in local dev a Postgres container. Stages are `production` and `dev_<user>`; anything else fails.

## Database access

Production reaches the one PlanetScale Postgres through a Hyperdrive connection. The Hyperdrive resource points at the existing database from `PLANETSCALE_*` and is never created or deleted with the database. Production deploys run the migrations first, and the Hyperdrive connection depends on that step. Local dev points Hyperdrive at Postgres in Docker from `DATABASE_URL`, and you run `vp run migrate` yourself.

`apps/api/src/index.ts` builds `Database` from `Drizzle.Postgres(hyperdrive.connectionString)` (`alchemy/Drizzle/Postgres`). It connects on the first query and closes with the request, so no connection is shared across requests. The same init also runs at deploy time with no binding, so nothing may read the connection string before a request.

Never capture a request, caller or response headers in an isolate-wide singleton.

A failed query never reaches the client. `RpcServer` sends defects to the client with their message, so the `HideDefects` middleware on `Api` logs each defect and replaces it with a bare "internal error". drizzle puts bound params in its error message, which would land in that log, so every database Effect pipes through `dieOnDatabaseError` from `@amerik/db`. It logs the error tag and the SQL with placeholders, then dies with a messageless `DatabaseFault`.

Browser RPC posts to exactly `/rpc`, forwarded by the web Worker to the API binding. SSR uses `serverLayer`, which calls the binding directly. See [the bridge contract](SOLID-EFFECT-BINDING.md).

## Adding an operation

1. Define its payload, result and expected errors in `packages/contracts`. Add an error only when the client does something different with it.
2. Implement it as an `Effect.fn` in its domain file in `apps/api/src` (`orders.ts`, `stock.ts`) that reads `Database` from context. A write pipes through `transaction` from `@amerik/db`. Reach for a service class only when there are two implementations or captured config.
3. Add a one-line handler in `rpc.ts`.
4. Run `vp check` and `vp run build`. New test files need the owner's approval.

## Adding a table

1. Add its branded id to `packages/contracts/src/ids.ts`, then declare it with `shop.table(...)` in `packages/db/src/schema.ts`.
2. Run `vp exec drizzle-kit generate` inside `packages/db`, review the SQL, and commit it.
3. Run `vp run migrate` against local Postgres.
