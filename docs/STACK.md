# Stack

Versions live in package manifests. This file says why, and what to watch.

Beta and RC are fine here. Pin them exactly.

## Now

| Tool                   | Version                                                                                             | Why                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| vite-plus (`vp`)       | 0.3.2 from the scaffold. **Bump to 1.0.0**, the current `latest`, which the owner's other repos use | One CLI for install, dev, build, lint, format          |
| pnpm                   | 12, workspace catalogs                                                                              | Same as tranzfer2                                      |
| solid-js, @solidjs/web | 2.0.0-rc.13                                                                                         | API frozen. Fine-grained, small, and server components |
| @solidjs/vite-plugin   | 3.0.0-next.35 (latest next is 47, bump when needed)                                                 | Start mode: generated entries, SSR, server functions   |
| @solidjs/router        | 2.0.0-next.32                                                                                       | next.34 was too new for the minimum release age        |
| filesystem-routing     | 0.4.0                                                                                               | File routes, required by the router                    |

## Planned

| Tool                                     | Why                                                                                                                         |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Effect 4 (4.0.0 stable since 2026-10-01) | RPC contracts with tagged errors, services, config. The `http`, `rpc` and `sql` modules are marked unstable, so pin exactly |
| PlanetScale Postgres via Hyperdrive      | Keep the real data where it is. No D1 migration                                                                             |
| drizzle-orm 1.0 rc, `effect-postgres`    | Effect-native Drizzle. Precedent: `tranzfer2-references/apps/t3code/infra/relay`                                            |
| Alchemy 2 (beta.79+)                     | Prod, staging and a stage per PR with its own PlanetScale branch. `yield* Cloudflare.cache()` for Workers Cache             |
| better-auth                              | Same as tranzfer2                                                                                                           |
| Cloudflare Workers Cache                 | The only cache. `Cache-Control` + `Cache-Tag`, purge on product edit                                                        |
| Zernio                                   | Messenger, posts, reels, comment-to-DM, analytics                                                                           |
| Remotion                                 | Reel templates rendered from catalog data, on a cron outside Workers. Check the license for small companies                 |
| postal-mime                              | Parse Amazon emails in the `email()` handler                                                                                |

## Gaps on Solid 2

- **TanStack Table and TanStack Form don't work on Solid 2.** They import `mergeProps` and `batch`, which were removed. Wrap `@tanstack/table-core` with a store. Forms are Effect Schema plus `action()`.
- **Kobalte is alpha** with an exact peer pin. Use native elements first.
- **Chart wrappers are Solid 1 only.** Use uplot or echarts directly through a ref.
- **`@astrojs/solid-js` doesn't support Solid 2.** No Astro.

## Rules worth remembering

- **Server components** (`serverFunctions: { components: true }`) are experimental and outside 2.0's stability guarantees. Before the storefront depends on them, a preview deploy has to pass: correct status codes, single-hop 301s, canonical, meta and JSON-LD in the rendered HTML, and a sitemap per host. The owner's DUND demo already ran them on a Worker (Lighthouse mobile 90 to 93; weak spot: 180 to 269ms of blocking time).
- **Workers Cache purges only hit the calling Worker and entrypoint.** The API can't purge the storefront's cache. It calls the storefront over a service binding, and the storefront purges itself.
- **Cached documents never contain user data.** Anything touching a session sends `no-store`.
- **The prerenderer runs in Node without bindings**, and static assets can't vary by host. So: SSR plus edge cache, not build-time prerender, for anything multi-domain.

## Check before relying on

- Zernio pricing: first 2 accounts free, about 10k outbound messages a month free (reported).
- Whether Zernio publishes Facebook **Reels**, not just Facebook videos. Instagram Reels are confirmed.
- Amazon's multi-item add-to-cart URL for the prefilled reorder cart.
- Whether `@effect/sql-pg`, which uses `node:net`, runs over Hyperdrive on Workers. The Alchemy Drizzle helper suggests yes, but it's untested here.
