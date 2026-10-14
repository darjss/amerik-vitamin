# Code conventions

Rules for Effect code, Solid glue and tests. They come from the executor references (`~/dev/tranzfer2-references/apps/executor-v2` and `apps/executor`) and from tranzfer2, adapted to this repo. Lint enforces some; the rest is judgment. Where code goes is in [STRUCTURE.md](STRUCTURE.md).

## Failure

- Failures live in the Effect error channel as tagged errors. Use `Schema.TaggedError` in `packages/contracts` for wire errors and `Data.TaggedError` inside the API.
- Add an error type only when a caller recovers differently: a distinct UI state, retry rule or status. Otherwise reuse one.
- Build the error at the failure site with `new DomainError(...)`. A helper earns its place by classifying or translating an outside error, not by wrapping a constructor.
- A failing input stays a failure. Never turn it into `false`, `null`, `[]` or `"unknown"` to quiet a type.
- Keep `try/catch`, `throw` and `.catch` at a true adapter edge: a browser API, a webhook signature check or the Worker entry. Contain it in one function that translates straight into a typed failure, and say so in a one-line comment.
- UI handlers read mutation results as `Exit` from `runPromiseExit` and branch on `Exit.isFailure`. They do not wrap `runPromise` in `try/catch`.
- Database failures are defects: pipe database Effects through `dieOnDatabaseError` (see [STRUCTURE.md](STRUCTURE.md#database-access)). The one exception is the health probe, which maps any failure to `DatabaseUnavailable` because the caller wants to know.
- `Effect.ignore` and `Effect.ignoreCause` take `{ log: true }` or a severity, so a dropped failure still reaches the logs.

## Unknown data

- Decode untrusted input once, at the boundary, with `Schema.decodeUnknownEffect`. Parse JSON strings with `Schema.fromJsonString(MySchema)`. Webhook bodies from QPay, tu-delivery, Telegram and Zernio are untrusted input.
- Domain code receives the decoded type. It does not probe `unknown` with `in`, `Reflect.get`, `as unknown as X` or `JSON.parse(...) as X`.
- A cast needs a narrow scope and a comment stating the invariant that makes it true.

## Types come from values

- Schema first: `export type Product = typeof Product.Type`. No hand-written interface beside a schema that describes the same shape.
- Value first: a service object built by a factory exports `ReturnType<typeof make>`. Keep an explicit interface only when several implementations share it.
- Skip return annotations. Inference is the source of truth.
- Ids are branded per table in `packages/contracts/src/ids.ts`. An `id` or `*Id` typed as `string` or `Schema.String` fails lint; an outside id (an Amazon order, a QPay invoice) gets its own brand there too.
- Time comes from Effect: `DateTime.now` or `Clock.currentTimeMillis`, never `Date.now()` or `new Date()`, so `TestClock` moves every clock at once.

## Named workflows

- Every non-trivial Effect is `Effect.fn("Service.method")(function* method() {...})`. The name is the span. Private steps with real logic get the same treatment; one-line query helpers do not.
- Sequence with `Effect.gen` or `Effect.andThen`. Check the installed Effect for every API before using it. Effect 4 is stable, but the `http`, `rpc` and `sql` modules can still move.

## Running effects

- `runFork`, `runPromise`, `runPromiseExit` and `ManagedRuntime` appear only at edges: the web runtime bridge in `apps/web/src/api`, window callbacks, Solid event handlers and actions, scripts such as `packages/db/src/migrate.ts`, and tests. Domain code returns Effects.
- HTTP inside `apps/api` goes through Effect's `HttpClient`. Raw `fetch` is allowed where the platform demands it: a Worker `fetch` export and a service-binding call.

## Structure

- Import another workspace package through its name (`@amerik/contracts`), never a relative path across a package root.
- Extract a helper when two callers share behavior, not when two lines look alike. State shared by several views lives in the feature's state module, not in a view.
- Export what other modules read. Setters and internals stay module-private.

## Database

- Every v2 table is declared with `shop` from `packages/db/src/schema.ts`. Nothing in this repo reads or writes vit-store's `ecom_vit_*` tables.
- Raw `sql` templates live in `packages/db`. Other code calls a named query from there.
- Atomic work uses transactions through `db.$client.withTransaction`, not D1-style batches.
- Migrations are generated with `drizzle-kit generate` and applied with `vp run migrate`. A hand edit to a generated migration needs a one-line comment saying why.

## Solid

- State that tracks an in-flight mutation (pending rows, optimistic status) is `createOptimistic` or `createOptimisticStore` inside an `action`. It never sits in a plain signal cleaned up by `try/finally`.
- Reactivity diagnostics are defects. The repair list is in [LIBRARIES.md](LIBRARIES.md#reactivity-diagnostics).

## Tests

- New test files need the owner's approval.
- Import from `@effect/vitest`, never `vitest`.
- Database tests use `testDatabase` from `@amerik/db/testing`: a fresh, migrated Postgres database per layer, created next to `DATABASE_URL` and dropped afterwards. Run them with `vp run test` while local Postgres is up.
- Keep `expect` outside `if`, ternaries and `&&`. Split the cases, or assert the whole value.
- Time-based rules use `TestClock`. Assert through the service API or the typed client.
- A failing assertion means the product or the test is wrong. Fix one of them; do not weaken the assertion.

## Lint exceptions

An exception is a file-scoped override with a one-line reason, approved by the owner. A blanket disable for a rule is a defect.
