# Stack

Versions live in package manifests. This file says why, and what to watch.

Beta and RC are fine here. Pin them exactly, and track the newest release past the release age.

## Shape

```text
apps/api             Effect RPC, /health, webhooks (QPay, tu-delivery, Telegram), cron (Khaan, auto-cancel, morning brief)
apps/web             Solid 2 start: mom's dashboard now, the three storefronts later, keyed by hostname
apps/messenger       the bot, ported from vit-store: Ingress + Conversation Durable Objects (not built yet)
packages/contracts   the Api RpcGroup and its tagged errors
packages/db          drizzle schema (Postgres schema `shop`), migrations, the Database service
infra                Alchemy stack `amerik-vitamin`
```

- **`apps/web` reaches `apps/api` through a service binding,** the same shape as tranzfer2. SSR calls the binding directly. The browser posts to `/rpc` on the web Worker, which forwards it.
- **Workers Cache purges only hit the Worker that calls them.** So `apps/api` tells `apps/web` to purge, over a binding, and `apps/web` purges itself.
- **Layout.** The workspace follows tranzfer2 (vp, pnpm catalogs, `apps/*`, `packages/*`, `infra`). The API's split into domain code in `src` and Cloudflare resources in `infra`, and everything about Postgres, Hyperdrive and Docker, follow executor (`apps/hosted/cloud`). Details in [STRUCTURE.md](STRUCTURE.md).

## Database (decided)

- **One database:** the existing PlanetScale Postgres that vit-store uses. v2 tables live in the Postgres schema `shop`, next to `ecom_vit_*` in `public`. The old tables get dropped after cutover. `drizzle.config.ts` sets `schemaFilter: ["shop"]`, so drizzle-kit never diffs them.
- **No PlanetScale branches.** They cost money. Alchemy never provisions a PlanetScale database or branch. Dev and tests run on local Postgres in Docker, which `vp run dev` starts. Only `main` deploys to prod.
- **Workers reach it through Hyperdrive.** Production uses the `PLANETSCALE_*` origin with `verify-full` and an uploaded ISRG Root X1 certificate. Dev points Hyperdrive at the Docker Postgres from `DATABASE_URL`. The precedents are `~/dev/tranzfer2-references/apps/executor/apps/hosted/cloud/src/infrastructure/database.ts` and `~/dev/tranzfer2-references/apps/t3code/infra/relay`. tranzfer2 itself runs on D1, so copy its Worker and RPC shape, not its database code.
- **Migrations.** `vp run migrate` applies `packages/db/migrations` to `DATABASE_URL`, with the journal in `shop.migrations`. A production deploy runs the same script through a `Command.Exec` resource, and the Hyperdrive connection depends on it.
- **Transactions** go through `transaction` from `@amerik/db`, which wraps `db.$client.withTransaction`. There is no D1-style batch.

## Images (decided)

- **Product photos live in v2's own R2 bucket, `ProductImages`, served at `img.amerikvitamin.mn`** (`apps/api/infra/images.ts`). Nothing is copied from vit-store's bucket or `cdn.amerikvitamin.mn`. The hostname has no "v2" in it, so the URLs stored in `products.images` outlive the cutover. Only production attaches the domain, and the bucket is retained on destroy.
- **A dev bucket has no domain.** Dev photo URLs are `/img/<key>` paths; the web Worker forwards them to the API's `/img/*` route, which reads the bucket binding.

## New products (decided)

- **An Amazon link or a bottle photo becomes a filled-in form through the `ProductDraft` Cloudflare Workflow** (`apps/api/src/drafts.ts`). Each step is a Workflow step, so Cloudflare stores its result and retries it: read the photo, find the Amazon listing, fill the fields, write the Mongolian copy, keep the product photos. The run's output is the draft; Cloudflare keeps it 30 days. The run touches no database, so the alchemy beta's missing per-step database scope doesn't matter. Only `createProduct`, after she confirms, writes.
- **Firecrawl v2 REST, not its SDK.** The SDK pulls in axios and zod 3. `apps/api/src/firecrawl.ts` calls `/v2/scrape` through Effect's `HttpClient`: the `product` format (1 credit) gives title, brand, price and the full-size gallery, and a `json` format reads the supplement facts. Amazon's own search page, read with a `json` format, finds listings for a photo.
- **The models are gpt-6-luna (fields, photo picks) and gpt-6-sol (Mongolian copy)** on the owner's CLIProxyAPI behind the `cliproxy.darjs.dev` tunnel, with a key of its own. Secrets: `MODEL_BASE_URL`, `MODEL_API_KEY`, `FIRECRAWL_API_KEY`.
- **The copy can't make health claims.** A banned-word check sends it back once; a second hit reaches her as a note on the form.

## Now

Exact versions live in the `pnpm-workspace.yaml` catalog. This table says why each tool is here and what to watch when bumping it.

| Tool                                      | Why, and what to watch                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| vite-plus (`vp`)                          | One CLI for install, dev, build, lint, format. The catalog's `vite` alias must match its `vite-plus-core` version                                                                                                                                                                                                                           |
| pnpm                                      | Workspace catalogs, same as tranzfer2                                                                                                                                                                                                                                                                                                       |
| typescript                                | Native compiler. Stable releases only, never the nightly `-dev` builds                                                                                                                                                                                                                                                                      |
| effect, `@effect/*`                       | RPC contracts with tagged errors, services, config. Bump `effect`, `@effect/sql-pg`, `@effect/platform-node` and `@effect/vitest` together                                                                                                                                                                                                  |
| drizzle-orm, drizzle-kit                  | Effect-native Drizzle 1.0 rc. Only commit-tagged builds exist, so pick the newest `1.0.0-rc.*` past the release age                                                                                                                                                                                                                         |
| alchemy                                   | Stages (prod plus local dev), Hyperdrive, Docker, Command                                                                                                                                                                                                                                                                                   |
| solid-js, @solidjs/web                    | Solid 2 rc. Bump together                                                                                                                                                                                                                                                                                                                   |
| @solidjs/vite-plugin                      | Start mode: generated entries, SSR, server functions. next.48 changed middleware to `(event, next)`, so `apps/web/src/middleware.ts` adapts it for filesystem-routing 0.4.0. Drop the adapter when filesystem-routing takes the event                                                                                                       |
| @solidjs/router, filesystem-routing       | Router 2 and its file routes                                                                                                                                                                                                                                                                                                                |
| @cloudflare/vite-plugin                   | Builds the web Worker. Alchemy injects its own copy in dev and deploy. Stay on the 1.x line, not the 2.0 beta snapshots                                                                                                                                                                                                                     |
| vitest, @effect/vitest                    | Tests. vitest must equal the copy bundled in vite-plus                                                                                                                                                                                                                                                                                      |
| oxlint, @oxlint/plugins                   | Must equal the oxlint vite-plus runs, or anti-slop's plugin API breaks                                                                                                                                                                                                                                                                      |
| @effect/tsgo                              | Effect diagnostics in `vp check`. `prepare` runs `effect-tsgo patch --oxlint` on every install                                                                                                                                                                                                                                              |
| eslint-plugin-solid                       | Solid v2-strict rules on `apps/web`                                                                                                                                                                                                                                                                                                         |
| khaan-client                              | The owner's Khaan SDK, pinned to a git commit because it isn't on npm. It only reads: one login per cron run on the remembered device, then the ~10 latest transactions. A login that wants an OTP fails the run as `auth` until the owner logs in once with its CLI. Promise-based, wrapped at the edge in `apps/api/src/khaan.ts` (PR #8) |
| better-auth, @better-auth/drizzle-adapter | Google sign-in only, 90-day sessions for mom's phone, `DASHBOARD_EMAILS` as the allowlist. Runs per request on the API Worker (PR #9)                                                                                                                                                                                                       |

**After any bump,** run `vp check --quiet`, `vp run test` and `vp run -r build`, then boot `vp run dev` and load the home page. A typecheck and build passed through the next.49 middleware break.

`effect`, `@effect/sql-pg`, `@effect/platform-node`, `@cloudflare/workers-types`, `vitest` and `typescript` are pnpm `overrides` to their catalog version. Without that, peers resolve to stale copies: drizzle-orm installs twice and breaks types between `@amerik/db` and alchemy, and a second vitest splits the test runner.

## Lint

`lint.config.ts` is the one lint config. Every rule is at error and a warning fails `vp check`, so there is no warning baseline. It runs oxlint's defaults plus:

- [anti-slop](https://github.com/dmmulroy/anti-slop), vendored in `tools/oxlint/anti-slop` with its Effect rules. The copy is ours: change rules there and record the change in its `UPSTREAM.md`.
- The `amerik` plugin in `tools/oxlint/anti-slop/amerik`, this repo's own rules: `no-sql-template`, `one-clock`, `no-string-id` and `no-silent-ignore`. Each rule has one RuleTester test beside it, run by `vp run test`.
- effect-tsgo's `antipattern` and `correctness` presets on all code in `apps`, `packages` and `infra`, so Effect 3 names fail wherever they appear.
- eslint-plugin-solid v2-strict on `apps/web`.
- `max-lines` 600 per file.
- Import boundaries: `apps/web` and `packages/contracts` never import the database or Alchemy, and `apps/api/infra` never imports `apps/api/src`.

Ultracite is out on purpose. Its generic TypeScript rules fight Effect idioms.

## Planned

| Tool                                                       | Why                                                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Cloudflare Workers Cache                                   | The only cache. `Cache-Control` + `Cache-Tag`, purge on product edit                              |
| `agents@0.24.0`, `chat@4.41.0`, `@zernio/chat-sdk-adapter` | The bot, as built in vit-store #339 to #346                                                       |
| Zernio                                                     | Messenger, posts, reels, comment-to-DM, analytics                                                 |
| Remotion                                                   | Reels rendered from catalog data on a cron outside Workers. Check the license for small companies |
| postal-mime                                                | Parse Amazon emails in the `email()` handler                                                      |

## UI (decided 2026-10-18)

Each package is added with the first screen that uses it, and Solid moves to rc.15 in the same PR. Solid rc.15, Panda and the Phosphor icons landed with the first screens (PR #11). solid-toast's peer is `^2.0.0-rc.15`. tranzfer2 runs Panda, Phosphor and solid-toast on Solid 2.

| Package                                     | Use                                                                                                                                                                          |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Panda CSS                                   | Styling: tokens and recipes at build time, no runtime                                                                                                                        |
| `terracotta` 2.0 next                       | Headless dialog, combobox, select, menu, tabs. Native elements first. No floating positioning, so popups sit in the flow. After a combobox pick, set the input text yourself |
| `@solid-primitives/form` 1.0 next           | Field, touched and error signals. Validators wrap the Effect Schemas from `@amerik/contracts`, and the submit goes through a Solid `action()`                                |
| `@iconify-json/ph` through `unplugin-icons` | Phosphor icons                                                                                                                                                               |
| `@trev.zip/solid-toast`                     | Toasts                                                                                                                                                                       |

A spike on Solid 2.0.0-rc.15 settled it. terracotta 2.0.0-next.10 rendered through Vite SSR. Its dialog trapped focus, closed on Escape and returned focus, and its combobox filtered and picked by keyboard. Rejected:

- **Kobalte 2.0.0-alpha.3:** Escape doesn't close its dialog, it logs `EFFECT_WRITES_OWN_SOURCE`, and its open issue #717 loses button hydration under the Solid 2 RC. Look again at its beta.
- **Ark UI 6 next and Zag 2 next:** they still import `solid-js/web` and `solid-js/store`.
- **corvu, solid-headless, Formisch, Modular Forms, Felte:** Solid 1 peers only.
- **TanStack Form 2 alpha:** calls `mergeProps` and `splitProps`.

## Messenger is ported as Effect code (decided)

`apps/messenger` is ported fully Effect-ified: services and layers, tagged errors, webhooks decoded with Schema, and Effect `HttpClient` for Zernio, Telegram and OpenAI. It is modeled on executor. vit-store's behavior stays (see [LEGACY.md](LEGACY.md)). The code shape does not.

## Alchemy gate

Alchemy stays only if it proves deploy, migrations, secrets and rollback on prod. Any failure means wrangler plus drizzle-kit migrations, and nothing else changes.

Deploy and migrations passed on 2026-10-18: the first production deploy created `shop` on PlanetScale and left the vit-store tables' row counts unchanged. Secrets and rollback are still unproven. Every later plan shows `Migrations`, `Postgres` and `Api` as updates, because `Migrations` runs on every deploy and the plan can't know its hash in advance.

The production web Worker serves `v2.amerikvitamin.mn` and the API Worker `api-v2.amerikvitamin.mn`, where QPay's callback lands. vit-store keeps the apex and its other subdomains until cutover. (PR #8)

The API Worker's secrets (`QPAY_*`, `KHAAN_*`, `TELEGRAM_ADMIN_*`) are `Config` reads in its init, which Alchemy binds as secret text at deploy. The production plan lists all ten as redacted additions; whether they arrive in the deployed Worker is the secrets half of this gate. (PR #8)

## Gaps on Solid 2

- **TanStack Table and TanStack Form don't work on Solid 2.** They import `mergeProps` and `batch`, which were removed. Wrap `@tanstack/table-core` with a store. Forms are under [UI](#ui-decided-2026-10-18).
- **Chart wrappers are Solid 1 only.** Use uplot or echarts directly through a ref.
- **`@astrojs/solid-js` doesn't support Solid 2,** so there's no Astro.

## Rules worth remembering

- **Server components** (`serverFunctions: { components: true }`) are experimental, outside 2.0's stability guarantees. Before a storefront depends on them, a deployed Worker has to pass:
  - correct status codes and single-hop 301s
  - canonical, meta and JSON-LD in the rendered HTML
  - a sitemap per host
  - a cache HIT, then a purge, then a MISS

  If it fails, use plain SSR. The owner's DUND demo already ran them on a Worker: Lighthouse mobile 90 to 93, with 180 to 269ms of blocking time as the weak spot.

- **Cached documents carry zero user data.** Anything that touches a session sends `no-store`.
- **The prerenderer runs in Node without bindings,** and static assets can't vary by host. Anything multi-domain gets SSR plus the edge cache.

## Check before relying on

- Does Zernio publish Facebook **Reels**, or just Facebook videos? Instagram Reels are confirmed.
- Amazon's multi-item add-to-cart URL for the prefilled reorder cart.
