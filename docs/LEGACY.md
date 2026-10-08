# vit-store autopsy

`darjss/vit-store` at `~/dev/vit-store` is the old system. It made real money. It's also full of bugs that look like features. Read this before porting anything.

Where these bugs came from, what the owner kept asking agents to do, and the repos before vit-store: [legacy/](legacy/README.md).

**Rule: recover behavior, never copy code.** If you're about to paste a vit-store file, stop and write down what behavior you actually want.

## Behavior worth recovering

| Behavior                                                   | Where in vit-store                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------- |
| QPay invoice and callback                                  | `packages/api` payment integrations, `apps/server` QPay webhook     |
| Khaan bank transaction matching                            | `khaan_consumed_transaction` table, transfer confirmation code      |
| tu-delivery dispatch                                       | `delivery_dispatch` table and delivery integration                  |
| The 8 store procedures the new Messenger bot calls         | `packages/api/src/routers/store/*` (see OPERATING_CONTEXT §3)       |
| Pricing formula                                            | `packages/api/src/lib/ai-product/constants.ts`                      |
| AI product extraction from Amazon URLs                     | `packages/api/src/lib/ai-product/*` (also store the ASIN this time) |
| Screenshot import for purchases                            | `packages/api/src/routers/admin/ai-purchase.ts`                     |
| Restock waitlist                                           | `restock_subscription` table                                        |
| Phone label batch printing over Bluetooth                  | open PR #294                                                        |
| Telegram callbacks, morning brief window, ship-paid-orders | `apps/agent`, `@vit/api/lib/integrations/admin-notifications`       |
| Catalog matcher for invoice lines                          | `packages/api/src/lib/ai/product-match.ts`                          |

## Bugs never to repeat

1. **The name rebuild.** `routers/admin/product.ts:493` rebuilds the name as `${brand} ${name} ${potency} ${amount}` from a form that already loaded the full name. Every save stacks the prefix and regenerates the slug without keeping the old one, so indexed URLs 404.
2. **Edit validated with the add schema.** `features/products/form/product-form.tsx:50` requires stock ≥ 1 and price ≥ 20000, so stock-0 products can't be edited. Saves overwrite live stock with the stale form value (`queries/products/admin.ts:351`).
3. **Fractional average cost into an integer column.** `queries/payments.ts:73` into `sales.product_cost`.
4. **All-or-nothing paid-order edits behind a generic toast** (`order.ts:539-550, 655-659`).
5. **Wrong stock math on transitions.** Cancel and refund don't return stock, delete only returns it when the payment succeeded, and stock can go negative.
6. **Search cards built from fake data** (`brandId: 0, categoryId: 0`) and then used for editing.
7. **Four cache layers.** A KV cache that's never invalidated (dashboards about 50 minutes stale) and an Upstash index rebuilt in full on every write (edits snap back).
8. **Orders keyed to `customers.phone`, an integer**, so changing a phone fails.
9. **A new Postgres pool per `db()` call**, never closed.
10. **Product update isn't atomic.** Images are soft-deleted outside the transaction with `Promise.allSettled` swallowing errors.
11. **SEO.** The sitemap lists noindex stubs and duplicates, "301s" are meta-refresh pages returning 200, OG images are SVG, and Product JSON-LD lacks `gtin`.
12. **`tags` declared as text holding JSON, `out_of_stock` as a manual status** next to the stock count (two sources of truth), and migrations drifted from the journal.

## Data facts

- Tables are prefixed `ecom_vit_`. The schema descends from a December 2024 Next.js + Turso repo (`darjss/ecom-dashboard`).
- Prod: 652 products, 483 orders, 367 customers, 0 purchase rows, 0 cart rows.
- The data copy into v2 is a reconciliation: counts, totals and stock must match, rehearsed on a snapshot first.

## Open vit-store PRs

- **Close, already merged into main:** #316, #317, #318, #319, #321, #324, #325, #326, #328, #330, #331.
- **Close, superseded:** #332 and #143.
- **Messenger stack, the live work:** #339 to #344.
- **Behavior to recover, don't merge into vit-store:** #294 (label printing) and #255 (PNG OG images).
- **Close or ignore under the rewrite:** #121, #225, #234, #244, #248.
