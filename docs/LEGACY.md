# vit-store autopsy

`darjss/vit-store` at `~/dev/vit-store` is the old system. It made real money. It's also full of bugs that look like features. Read this before porting anything.

Where these bugs came from, what the owner kept asking agents to do, and the repos before vit-store: [private/legacy/](private/legacy/README.md).

**Rule: recover behavior, write new code.** Before you touch a vit-store file, write down the behavior you want, then build that behavior here against COMMERCE-RULES.

**The one exception is `apps/messenger`.** It was written in October 2026 for this architecture, so it gets ported as code. The port changes two things:

- its store client calls the new Effect RPC contract instead of tRPC
- its 12-hour `paused_until` handoff becomes the state machine in OPERATING_CONTEXT §3

## Behavior worth recovering

| Behavior                                                                                                          | Where in vit-store                                                                    |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| QPay invoice and callback, re-checked before it counts                                                            | `packages/api/src/lib/payments/qpay.ts`, `apps/server/src/routes/payments.ts`         |
| Khaan matching: exact amount, payment number or phone in the description, fingerprint unique per bank transaction | `apps/server/src/lib/khaan/match-transfer.ts`, `khaan_consumed_transaction`           |
| Khaan polling after a customer claims they paid                                                                   | `apps/server/src/durable-objects/transfer-reconciliation-object.ts`                   |
| tu-delivery dispatch with a duplicate guard                                                                       | `packages/api/src/lib/integrations/delivery/index.ts`, `delivery_dispatch`            |
| Telegram admin: order alerts, morning brief, callback buttons                                                     | `apps/messenger/src/admin/`, `packages/api/src/lib/integrations/admin-notifications/` |
| Pricing formula                                                                                                   | `packages/api/src/lib/ai-product/constants.ts`                                        |
| AI product extraction from Amazon URLs (store the ASIN this time)                                                 | `packages/api/src/lib/ai-product/*`                                                   |
| Screenshot import for purchases                                                                                   | `packages/api/src/routers/admin/ai-purchase.ts`                                       |
| Catalog matcher for invoice lines                                                                                 | `packages/api/src/lib/ai/product-match.ts`                                            |
| Restock waitlist                                                                                                  | `restock_subscription` table                                                          |
| Phone label batch printing over Bluetooth                                                                         | open PR #294                                                                          |
| PNG OG images                                                                                                     | open PR #255                                                                          |

## Bugs to never repeat

1. **The name rebuild.** `routers/admin/product.ts:493` rebuilds the name as `${brand} ${name} ${potency} ${amount}` from a form that already loaded the full name. Every save stacks the prefix and regenerates the slug without keeping the old one, so indexed URLs 404.
2. **Edit validated with the add schema.** `features/products/form/product-form.tsx:50` requires stock ≥ 1 and price ≥ 20000, so stock-0 products can't be edited. Saves overwrite live stock with the stale form value (`queries/products/admin.ts:351`).
3. **Fractional average cost into an integer column.** `queries/payments.ts:73` into `sales.product_cost`.
4. **All-or-nothing paid-order edits behind a generic toast** (`order.ts:539-550, 655-659`).
5. **Wrong stock math on transitions.** Cancel and refund don't return stock, delete only returns it when the payment succeeded, and stock can go negative silently.
6. **Search cards built from fake data** (`brandId: 0, categoryId: 0`) and then used for editing.
7. **Four cache layers.** A KV cache that's never invalidated (dashboards about 50 minutes stale) and an Upstash index rebuilt in full on every write (edits snap back).
8. **Orders keyed to `customers.phone`, an integer**, so changing a phone fails.
9. **A new Postgres pool per `db()` call**, never closed.
10. **Product update isn't atomic.** Images are soft-deleted outside the transaction with `Promise.allSettled` swallowing errors.
11. **SEO.** The sitemap lists noindex stubs and duplicates, the "301s" are meta-refresh pages returning 200, OG images are SVG, and Product JSON-LD lacks `gtin`.
12. **Two sources of truth.** `tags` is text holding JSON. `out_of_stock` is a manual status next to the stock count. Migrations drifted from the journal.
13. **Handoff on a timer.** The bot pauses for 12 hours and then talks again on its own, mid-conversation.

## Data facts

- **Tables are prefixed `ecom_vit_`** and live in the same PlanetScale database v2 uses. The schema descends from a December 2024 Next.js + Turso repo (`darjss/ecom-dashboard`).
- **Prod has 652 products, 483 orders, 367 customers, 0 purchase rows and 0 cart rows.**
- **Products have no gtin, upc or asin column.** `amount` is a varchar pill count. `dailyIntake` defaults to 0, which means unknown. `oldSlugs` is jsonb.

## Migration into v2

It's a reconciliation, rehearsed on a local dump first:

| Legacy                           | v2                                        |
| -------------------------------- | ----------------------------------------- |
| `pending` orders                 | `cancelled`, because they were never paid |
| `shipped` or `delivered` orders  | `delivered`                               |
| `cancelled` or `refunded` orders | `cancelled`                               |
| `sales.product_cost = 0`         | `null`                                    |
| successful payments              | payments                                  |
| customer phone integer           | 8-digit text                              |
| current slug and `oldSlugs`      | slug history                              |

Done means counts per table, order totals by status and payment sums match vit-store's own SQL.

**vit-store gets no new work.** The one exception is a fix that stops live data corruption while it still runs.

## Open vit-store PRs

- **Close as superseded:** #332, #143.
- **Close under the rewrite:** #121, #225, #234, #244, #248.
- **Leave open as reference:** #294 (label printing) and #255 (PNG OG). Their behavior gets recovered here.
