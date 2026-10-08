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
- **Layout.** The workspace follows tranzfer2 (vp, pnpm catalogs, `apps/*`, `packages/*`, `infra`). The API's inner split (`implementation/`, `infrastructure/`) and everything about Postgres, Hyperdrive and Docker follow executor-v2 (`apps/hosted/cloud`). Details in [STRUCTURE.md](STRUCTURE.md).

## Database (decided)

- **One database:** the existing PlanetScale Postgres that vit-store uses. v2 tables live in the Postgres schema `shop`, next to `ecom_vit_*` in `public`. The old tables get dropped after cutover. `drizzle.config.ts` sets `schemaFilter: ["shop"]`, so drizzle-kit never diffs them.
- **No PlanetScale branches.** They cost money. Alchemy never provisions a PlanetScale database or branch. Dev and tests run on local Postgres in Docker, which `vp run dev` starts. Only `main` deploys to prod.
- **Workers reach it through Hyperdrive.** Production uses the `PLANETSCALE_*` origin with `verify-full` and an uploaded ISRG Root X1 certificate. Dev points Hyperdrive at the Docker Postgres from `DATABASE_URL`. The precedents are `~/dev/tranzfer2-references/apps/executor-v2/apps/hosted/cloud/src/infrastructure/database.ts` and `~/dev/tranzfer2-references/apps/t3code/infra/relay`. tranzfer2 itself runs on D1, so copy its Worker and RPC shape, not its database code.
- **Migrations.** `vp run migrate` applies `packages/db/migrations` to `DATABASE_URL`, with the journal in `shop.migrations`. A production deploy runs the same script through a `Command.Exec` resource, and the Hyperdrive connection depends on it.
- **Transactions** go through `db.$client.withTransaction`. There is no D1-style batch.

## Now

| Tool                      | Version                                                             | Why                                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| vite-plus (`vp`)          | 1.0.0, and the `vite` alias to `@voidzero-dev/vite-plus-core` 1.0.0 | One CLI for install, dev, build, lint, format                                                                                                  |
| pnpm                      | 12, workspace catalogs                                              | Same as tranzfer2                                                                                                                              |
| typescript                | 7.0.2                                                               | Native compiler, same as tranzfer2                                                                                                             |
| effect                    | 4.0.0                                                               | RPC contracts with tagged errors, services, config. 4.0.1 was inside the 24h release age                                                       |
| @effect/sql-pg            | 4.0.0                                                               | Postgres driver under drizzle's `effect-postgres`                                                                                              |
| drizzle-orm, drizzle-kit  | 1.0.0-rc.5-ab785fc                                                  | Effect-native Drizzle. The rc tag tranzfer2 and the relay use                                                                                  |
| alchemy                   | 2.0.0-beta.80                                                       | Stages (prod plus local dev), Hyperdrive, Docker, Command. beta.81 exists                                                                      |
| @cloudflare/workers-types | 5.20260911.1                                                        | 5.20261005.1 was inside the release age                                                                                                        |
| solid-js, @solidjs/web    | 2.0.0-rc.13                                                         | API frozen. Fine-grained, small, server components                                                                                             |
| @solidjs/vite-plugin      | 3.0.0-next.47                                                       | Start mode: generated entries, SSR, server functions. `renderMode: "async"` needs next.40 or newer, and next.43 passes an option rc.13 rejects |
| @solidjs/router           | 2.0.0-next.32                                                       | next.34 was too new for the minimum release age                                                                                                |
| filesystem-routing        | 0.4.0                                                               | File routes, required by the router                                                                                                            |
| @cloudflare/vite-plugin   | 1.54.8                                                              | Builds the web Worker. Alchemy injects its own copy in dev and deploy                                                                          |

Oxlint presets, `@effect/tsgo` and the oxlint/tsgolint overrides from tranzfer2 are not installed. `vp check` passes without them.

## Planned

| Tool                                                       | Why                                                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| better-auth                                                | Google sign-in only, long-lived sessions for mom's phone                                          |
| Cloudflare Workers Cache                                   | The only cache. `Cache-Control` + `Cache-Tag`, purge on product edit                              |
| `agents@0.24.0`, `chat@4.41.0`, `@zernio/chat-sdk-adapter` | The bot, as built in vit-store #339 to #346                                                       |
| [`khaan-client`](https://github.com/darjss/khaan-client)   | Khaan transactions for transfer matching                                                          |
| Zernio                                                     | Messenger, posts, reels, comment-to-DM, analytics                                                 |
| Remotion                                                   | Reels rendered from catalog data on a cron outside Workers. Check the license for small companies |
| postal-mime                                                | Parse Amazon emails in the `email()` handler                                                      |

## Messenger is ported as Effect code (decided)

`apps/messenger` is ported fully Effect-ified: services and layers, tagged errors, webhooks decoded with Schema, and Effect `HttpClient` for Zernio, Telegram and OpenAI. It is modeled on executor-v2. vit-store's behavior stays (see [LEGACY.md](LEGACY.md)). The code shape does not.

## Alchemy gate

Alchemy stays only if it proves deploy, migrations, secrets and rollback on prod. Any failure means wrangler plus drizzle-kit migrations, and nothing else changes.

## Gaps on Solid 2

- **TanStack Table and TanStack Form don't work on Solid 2.** They import `mergeProps` and `batch`, which were removed. Wrap `@tanstack/table-core` with a store. Forms are Effect Schema plus `action()`.
- **Kobalte is alpha** with an exact peer pin. Reach for native elements first.
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

- `@effect/sql-pg` uses `node:net`. `/health` round-trips through the local Hyperdrive passthrough in `alchemy dev`. It is unproven against deployed Hyperdrive and PlanetScale until the first production deploy.
- The Cloudflare API token needs the mTLS certificates permission (account, SSL and Certificates) for the Hyperdrive CA upload. The token in `.env` lacked it when this was scaffolded.
- Does Zernio publish Facebook **Reels**, or just Facebook videos? Instagram Reels are confirmed.
- Amazon's multi-item add-to-cart URL for the prefilled reorder cart.
