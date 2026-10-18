# Libraries

Read this before you search `node_modules` or the web for how a library works. Each section says where the library's docs and types are installed, then lists traps that already cost someone time, here or in tranzfer2 on the same stack. Installed code beats this file, the skills and the reference checkouts. When one of them is wrong, fix it in the PR that finds out.

Checked on 2026-10-14 against effect 4.0.3, solid-js and @solidjs/web 2.0.0-rc.14, @solidjs/vite-plugin 3.0.0-next.49, filesystem-routing 0.4.0, alchemy 2.0.0-beta.81, drizzle-orm 1.0.0-rc.5-5935859 and vite-plus 1.1.0. The `pnpm-workspace.yaml` catalog holds the current versions.

## Finding installed source

- Resolve a package from the workspace that uses it. There is no root `node_modules/effect`. Effect is in `apps/api/node_modules/effect` (also `packages/db` and `apps/web`). Alchemy is in `apps/api/node_modules/alchemy` and `infra/node_modules/alchemy`. Solid is in `apps/web/node_modules`. drizzle is in `packages/db/node_modules`. The root holds Vite+ and the lint tools.
- Do not build `.pnpm/<hash>` paths. `rg -n 'name' apps/api/node_modules/alchemy/src` works as written.
- Never edit a file under `node_modules`. pnpm hard-links it from the shared store, so the edit reaches every worktree. Copy the file to `/tmp` or use `pnpm patch`.
- Run scratch scripts from inside the workspace package that owns the import, so they resolve the pinned copy.

## Effect

Read `apps/api/node_modules/effect/AGENTS.md`, then the examples in `apps/api/node_modules/effect/ai-docs/src/<topic>/` before you grep `src`. Topics: `01_effect` (basics, schema, services, errors, resources, running), `03_stream`, `04_integration`, `05_batching`, `06_schedule`, `07_datetime`, `08_observability`, `09_testing`, `40_sql`, `50_http-client`, `51_http-server`, `70_cli`, `71_ai`.

Types are the flat `effect/dist/*.d.ts`. Subpath modules are `effect/rpc`, `effect/http`, `effect/sql` and `effect/cli`. `@effect/tsgo` rules are listed in `node_modules/@effect/tsgo/README.md` at the root.

Names agents keep guessing from Effect 3. The old form does not exist.

| Old or guessed         | Use                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `Effect.either`        | `Effect.result` and `effect/Result`                                                 |
| `Effect.catchAll`      | `Effect.catch`                                                                      |
| `Effect.fork`          | `Effect.forkChild`, `forkDetach` or `forkScoped`                                    |
| `Config.mapOrFail`     | `Config.mapEffect`                                                                  |
| `Schema.decodeUnknown` | `Schema.decodeUnknownEffect`                                                        |
| `Effect.ignoreLogged`  | `Effect.ignore({ log: true })`. Lint requires the `log` option                      |
| `Exit.isInterrupted`   | `Cause.hasInterruptsOnly(exit.cause)`. `Exit.hasInterrupts` narrows else to `never` |

- `Effect.catchIf` is data-last only here: `effect.pipe(Effect.catchIf(refinement, f))`. The four-argument form fails with TS2769.
- `Data.TaggedError("X")` with no fields is `class X extends Data.TaggedError("X") {}`.
- `Effect.promise` turns a rejection into a defect, and `Effect.ignore` does not catch defects. Use `Effect.tryPromise` when the promise can reject.
- `Schema.brand` inside a generic helper needs the explicit type argument, `Schema.brand<Brand>(brand)`. See `packages/contracts/src/ids.ts`.

### RPC

- `RpcServer` sends `Die` defects to the client with their message. The `HideDefects` middleware on `Api` replaces them. drizzle's `EffectDrizzleQueryError.message` carries every bound param (drizzle #6471). Pipe database Effects through `dieOnDatabaseError` from `@amerik/db`, which logs the SQL with placeholders and dies with a messageless `DatabaseFault`.
- `SqlClient.withTransaction` turns a failed `ROLLBACK` or savepoint release into a defect holding the `SqlError` (`effect/src/sql/SqlClient.ts:466`), so `dieOnDatabaseError` never sees it. `HideDefects` does.
- `RpcClient.layerProtocolHttp({ url: "/rpc" })` posts to `/rpc/`. Set the URL with `transformClient: HttpClient.mapRequest(HttpClientRequest.setUrl("/rpc"))`, as `apps/web/src/api/client.ts` does.
- An `RpcClientError` from an HTTP failure has the message `"HttpError: "`. Log `reason.kind` and `reason.cause` yourself.

## Solid 2

Read `apps/web/node_modules/solid-js/CHEATSHEET.md` first; its last section lists the 2.0 corrections. Types are in `apps/web/node_modules/solid-js/types` and `apps/web/node_modules/@solidjs/web/types`. Server components: `apps/web/node_modules/@solidjs/web/skills/server-components`. The repo skill is `.agents/skills/solidjs-v2/SKILL.md`.

- `onMount` is `onSettled`, `Suspense` is `Loading`, `ErrorBoundary` is `Errored`, `<Dynamic>` is `dynamic(() => Component)`. There is no `MetaProvider`.
- `createEffect(compute, apply)` takes two functions.
- `@solidjs/vite-plugin` next.48 calls middleware as `(event, next)`. filesystem-routing 0.4.0 still takes the bare request, so `apps/web/src/middleware.ts` adapts it. A typecheck and a build both passed with the old shape; only loading a page showed the break.
- `HOT_SCOPE_TIME` is a wall-clock budget and flaked on tranzfer2's CI runners. When component tests land (`@solidjs/diagnostics` is not installed yet), set `captureArtifact(fn, { attribution: { hotTime: { budgetMs } } })` once instead of allow-listing it per test.

### Reactivity diagnostics

Treat every diagnostic as a defect and never allow-list one you haven't understood. The full repair guide is `apps/web/node_modules/solid-js/skills/reactivity-diagnostics/SKILL.md` (about 6k tokens, search it by code). Most codes come down to:

- `STRICT_READ_UNTRACKED`, `PENDING_ASYNC_UNTRACKED_READ`: a reactive read outside a tracking scope (destructured props, component body). Read it in JSX, a memo or an effect's compute half; `untrack()` if a one-time snapshot is the intent.
- `REACTIVE_WRITE_IN_OWNED_SCOPE`, `ACTION_CALLED_IN_OWNED_SCOPE`: a write, `refresh()` or action call during a component body or memo. Move it to an event handler or effect callback.
- `FLUSH_IN_ACTION`, `FLUSH_IN_EFFECT_CALLBACK`: delete the `flush()`. In tests, call `flush()` before reading the DOM.
- `NO_OWNER_EFFECT`, `NO_OWNER_CLEANUP`: create effects and `onCleanup` under a component or `createRoot`.
- `UNSTABLE_MEMO_OUTPUT`: the memo returns fresh but equal objects. Return stable references or pass `equals`.
- `HOT_SCOPE_*`, `HUGE_FAN_OUT`: a hot signal or one shared value read by many rows. Derive a slower value, or keep the answer in a store keyed by id.
- `EFFECT_WRITES_OWN_SOURCE`, `EFFECT_RELAY_TEAR`: an effect that writes derived state. Use `createMemo`.
- `IMMUTABLE_UPDATE_IN_STORE`, `UNSTABLE_LIST_IDENTITY`: mutate the store draft, or `reconcile(data, "id")`, and key `<For>` by a stable id.
- `ASYNC_WATERFALL`: read every async source before using any, so they start together.
- `SILENT_HOLD`, `LONG_HOLD`: add feedback with `isPending`, `latest` or an optimistic write. Never remove the hold; past 500 ms show a `Loading` fallback.

## Alchemy

Alchemy ships `src` and `lib` but no docs. Read `apps/api/node_modules/alchemy/src`, or https://alchemy.run/llms.txt. Files this repo touches: `Cloudflare/Hyperdrive/`, `Cloudflare/Workers/{Worker,WorkerBridge}.ts`, `Cloudflare/Website/Vite.ts`, `Drizzle/Postgres.ts`, `Stage.ts`.

- Leave Worker `name` unset. An explicit name makes every stage overwrite one Worker.
- `WorkerBridge.ts` installs `Logger.layer([Logger.consolePretty()])` without `mergeWithExisting`, which drops Effect's `tracerLogger`, so `Effect.log` never reaches spans. When telemetry lands, add `Logger.tracerLogger` back with `mergeWithExisting: true`. Alchemy's `layerOtlp` takes no `service.version`.
- `Axiom.providers()` reads credentials when the stack builds and fails every `alchemy plan` that has no Axiom profile. Add it only for the stages that ship telemetry.
- A failed Vite build under Alchemy beta.81 ends as `BundleError: Vite build child exited with code 1:` with no cause. Reproduce with `vp run --filter @amerik/web build` and read its output.
- A `Config` read during a Worker's init becomes a secret binding at deploy (`Platform.ts`, the config interceptor), and the same read returns the bound value at runtime. A read inside a request handler or a per-request layer is not bound, so read every secret in init and pass it to the layer. Plain values like `QPAY_URL` are bound as secrets too. (PR #PAYMENTS)
- Worker props may be an Effect: `ApiWorker.make(apiDomain.pipe(Effect.map(...)), impl)` sets `domain` per stage.
- `Cloudflare.Workers.cron(expression, handler)` in init attaches the Cron Trigger and listens for it; provide `Cloudflare.Workers.CronEventSourceLive` on the init. The event source swallows a failing handler, so Cloudflare never retries it. Log failures inside the handler.
- A handler's request `Scope` closes through `ctx.waitUntil` after the response is sent, so `Effect.addFinalizer` is the way to run work after the response (`/qpay/callback` dispatches the outbox this way). The Drizzle handle from `Drizzle.Postgres` is memoized on the current scope and closes with it; wrap after-response work in `Effect.scoped` so it opens its own connection.

## khaan-client

Source is in `~/dev/khaan-client` and `apps/api/node_modules/khaan-client/dist`. Read `src/auth/client.ts` first.

- `fetchTransactions()` returns only the ~10 newest lines on the account. There is no date range on the server. More than ten transfers between two cron runs means the oldest are never seen.
- `loginInitial()` succeeds in one step on a device that was remembered with an OTP once. Anything else returns `mfa_required`, which only the owner can clear.
- `tranDate` is the Ulaanbaatar date as a UTC-midnight ISO string and `time` is UB wall-clock `HH:MM`. Amounts are numbers, negative for outgoing; `isIncoming` checks the sign.
- Errors are its own classes (`KhaanAuthError`, `KhaanRateLimitError`, `KhaanNetworkError`), thrown from promises.

## QPay and Telegram

- QPay v2 `payment/check` returns `payment_amount` as a decimal string. The callback is a GET or POST to our `callback_url` with QPay's own query params appended; we read only our `order` param. (PR #PAYMENTS)
- Telegram's bot token is part of the request URL. Never log an `HttpClientError` from it, and turn off the HTTP span with `HttpClient.TracerDisabledWhen`.

## drizzle

Source is in `packages/db/node_modules/drizzle-orm`; the Effect driver is `drizzle-orm/effect-postgres`, its errors are in `drizzle-orm/effect-core`. Docs are at https://orm.drizzle.team/llms.txt.

- Only commit-tagged `1.0.0-rc.*` builds exist. Pick the newest past the release age.
- Generate migrations with `cd packages/db && vp run generate --name <slug>`. Do not put `--` before the flag.
- Raw `sql` templates live in `packages/db` only. Lint enforces it.

## Vite+ (`vp`)

Docs are local: `node_modules/vite-plus/docs` and `node_modules/vite-plus/AGENTS.md`.

- `vp <name>` is a built-in command and `vp run <name>` runs a `package.json` script. The "running vp check as a built-in command" note is noise.
- `vp install` runs each workspace `prepare`, which writes `apps/web/file-routes.d.ts`. Run it in every new worktree before `vp check`. When nothing changed, install skips `prepare`; `vp install --force` reruns it.
- Lint plugins import from `vite-plus/lint/plugins` and `vite-plus/lint/plugins-dev`, not `@oxlint/plugins`.
