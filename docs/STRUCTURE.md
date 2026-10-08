# Code boundaries

Use the directory tree as the file inventory. Add a package only for a real boundary, not as a generic home for helpers. The layout follows tranzfer2 for the workspace and executor-v2 (`apps/hosted/cloud`) for the API's inner split.

## Packages

- `packages/contracts` (`@amerik/contracts`) owns the wire API: schemas, branded ids, tagged errors and the `Api` RPC group. Errors carry data, not copy; the UI owns the words. It must not import handlers, database code or Worker bindings. Today it holds `Api` with one rpc, `health`, and `DatabaseUnavailable`.
- `packages/db` (`@amerik/db`) owns the Postgres schema, migrations and `Database`. `Database` is drizzle's Effect Postgres driver (`drizzle-orm/effect-postgres`) over `@effect/sql-pg`. Every table is declared with the `shop` schema from `schema.ts`; `drizzle.config.ts` sets `schemaFilter: ["shop"]` so drizzle-kit never touches vit-store's tables. `src/migrate.ts` applies `migrations/` to `DATABASE_URL`, and keeps its journal in `shop.migrations`.
- `apps/api` (`@amerik/api`) is the API Worker.
  - `src/implementation` owns the rules and the RPC handlers. `rpc.ts` is transport only: read the caller, call a service. `health.ts` is the database probe both `/health` and the `health` rpc use.
  - `src/infrastructure` owns everything Cloudflare or Alchemy: the Hyperdrive resource in `database.ts` and the stage check in `stage.ts`. Stage checks live here and nowhere else.
  - `src/index.ts` is the composition edge and `src/worker.ts` is the deploy-time identifier.
- `apps/web` (`@amerik/web`) is the Solid start app. `src/routes` owns page and HTTP route entry points, including the `/rpc` proxy to the API binding. `src/api` owns the RPC clients and the Solid bridge. Keep feature state beside its consumers.
- `infra` (`@amerik/infra`) holds `alchemy.run.ts`, which composes the stack `amerik-vitamin`: the API Worker, the web Worker, and in local dev a Postgres container. Stages are `production` and `dev_<user>`; anything else fails.

## Database access

Production reaches the one PlanetScale Postgres through a Hyperdrive connection. The Hyperdrive resource points at the existing database from `PLANETSCALE_*` and is never created or deleted with the database. Production deploys run the migrations first, and the Hyperdrive connection depends on that step. Local dev points Hyperdrive at Postgres in Docker from `DATABASE_URL`, and you run `vp run migrate` yourself.

`apps/api/src/index.ts` builds `Database` from `Drizzle.Postgres(hyperdrive.connectionString)` (`alchemy/Drizzle/Postgres`). It connects on the first query and closes with the request, so no connection is shared across requests. The same init also runs at deploy time with no binding, so nothing may read the connection string before a request.

Never capture a request, caller or response headers in an isolate-wide singleton.

Browser RPC posts to exactly `/rpc`, forwarded by the web Worker to the API binding. SSR uses `serverLayer`, which calls the binding directly. See [the bridge contract](SOLID-EFFECT-BINDING.md).

## Adding an operation

1. Define its payload, result and expected errors in `packages/contracts`. Add an error only when the client does something different with it.
2. Implement it as a method on a service in `apps/api/src/implementation`.
3. Add a one-line handler in `rpc.ts`.
4. Run `vp check` and `vp run build`. New test files need the owner's approval.

## Adding a table

1. Declare it with `shop.table(...)` in `packages/db/src/schema.ts`.
2. Run `vp exec drizzle-kit generate` inside `packages/db`, review the SQL, and commit it.
3. Run `vp run migrate` against local Postgres.
