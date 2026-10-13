# Stack

Versions live in package manifests. This file says why, and what to watch.

Beta and RC are fine here. Pin them exactly, and track the newest release past the release age.

## Shape

```text
apps/api         Effect RPC, webhooks (QPay, tu-delivery, Telegram), cron (Khaan, auto-cancel, morning brief)
apps/web         Solid 2 start: mom's dashboard now, the three storefronts later, keyed by hostname
apps/messenger   the bot, ported from vit-store: Ingress + Conversation Durable Objects
packages/db      drizzle schema and migrations
infra            Alchemy stack
```

- **`apps/web` reaches `apps/api` through a service binding,** the same shape as tranzfer2.
- **Workers Cache purges only hit the Worker that calls them.** So `apps/api` tells `apps/web` to purge, over a binding, and `apps/web` purges itself.

## Database (decided)

- **One database:** the existing PlanetScale Postgres that vit-store uses. v2 tables live in their own Postgres schema next to `ecom_vit_*`. The old tables get dropped after cutover.
- **No PlanetScale branches.** They cost money. Dev and tests run on local Postgres. Only `main` deploys to prod and runs migrations.
- **Workers reach it through Hyperdrive.** The precedent is `~/dev/tranzfer2-references/apps/t3code/infra/relay`: `Cloudflare.Hyperdrive.Connection`, `Drizzle.Postgres(hyperdrive.connectionString)`, and transactions via `db.$client.withTransaction`. tranzfer2 itself runs on D1, so copy its Worker and RPC shape, not its database code.

## Now

| Tool                   | Version                                                                                                                     | Why                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| vite-plus (`vp`)       | 0.3.2 in the scaffold, and so is the `vite` alias to `@voidzero-dev/vite-plus-core`. **Bump both to 1.0.0**, like tranzfer2 | One CLI for install, dev, build, lint, format        |
| pnpm                   | 12, workspace catalogs                                                                                                      | Same as tranzfer2                                    |
| solid-js, @solidjs/web | 2.0.0-rc.13                                                                                                                 | API frozen. Fine-grained, small, server components   |
| @solidjs/vite-plugin   | 3.0.0-next.35 (next.47 exists, bump when needed)                                                                            | Start mode: generated entries, SSR, server functions |
| @solidjs/router        | 2.0.0-next.32                                                                                                               | next.34 was too new for the minimum release age      |
| filesystem-routing     | 0.4.0                                                                                                                       | File routes, required by the router                  |

## Planned

| Tool                                                       | Why                                                                                                                         |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Effect 4.0.0 (stable since 2026-10-01)                     | RPC contracts with tagged errors, services, config. The `http`, `rpc` and `sql` modules are marked unstable, so pin exactly |
| drizzle-orm 1.0 rc, `effect-postgres`                      | Effect-native Drizzle over Hyperdrive                                                                                       |
| Alchemy 2 (beta.79+)                                       | Stages: prod plus local dev. Hyperdrive, secrets, cron, `Cloudflare.cache()`                                                |
| better-auth                                                | Google sign-in only, long-lived sessions for mom's phone                                                                    |
| Cloudflare Workers Cache                                   | The only cache. `Cache-Control` + `Cache-Tag`, purge on product edit                                                        |
| `agents@0.24.0`, `chat@4.41.0`, `@zernio/chat-sdk-adapter` | The bot, as built in vit-store #339 to #346                                                                                 |
| [`khaan-client`](https://github.com/darjss/khaan-client)   | Khaan transactions for transfer matching                                                                                    |
| Zernio                                                     | Messenger, posts, reels, comment-to-DM, analytics                                                                           |
| Remotion                                                   | Reels rendered from catalog data on a cron outside Workers. Check the license for small companies                           |
| postal-mime                                                | Parse Amazon emails in the `email()` handler                                                                                |

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

- `@effect/sql-pg` uses `node:net`. Does it run over Hyperdrive on Workers in this repo? The relay reference says yes. It's unproven here until `/health` round-trips.
- Does Zernio publish Facebook **Reels**, or just Facebook videos? Instagram Reels are confirmed.
- Amazon's multi-item add-to-cart URL for the prefilled reorder cart.
