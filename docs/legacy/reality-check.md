# Reality check

Two years of building one vitamin shop, measured. Every number comes from git history across 9 repos, 1,044 agent sessions from Jan to Sep 2026, and the vit-store prod facts in [../OPERATING_CONTEXT.md](../OPERATING_CONTEXT.md). Read this before starting anything new.

## The pattern

The app layer got rewritten every few months, and the data model never did:

- Next with Lucia
- Next with Turso and tRPC
- a Hono Worker, then a Hono Docker server
- a Turborepo
- TanStack Start, then TanStack Router
- React, then Solid
- D1 or Turso, then Postgres
- Zod, then Valibot
- Alchemy 1, then Alchemy 2
- now Solid 2, Effect 4 and Drizzle 1.0

Meanwhile all 13 tables from ecom-dashboard on New Year's Eve 2024, and 82 of their 85 columns, are still in prod. The framework was never the problem, and it got all the attention. The data model was the problem, and it got none.

## What the software sees

| Fact                                 | Number                    |
| ------------------------------------ | ------------------------- |
| Orders in the DB                     | 233, worth 50.9M₮         |
| Inferred real business               | about 1.3 to 1.8B₮ a year |
| Share the system sees                | about 3%                  |
| `sales.product_cost` rows that are 0 | all of them               |
| Orders that ever reached "delivered" | 1                         |
| Orders stuck in pending              | 57                        |
| The real ledger                      | mom's paper notebook      |

## Where 4.78B tokens went (Jan to Sep 2026)

Each session got one tag from a Sonnet reader, and the tags are grouped into buckets. Claude Code is excluded because it kept no token counts. 94% of the tokens are cache reads, so the dollar split is flatter than this.

| Bucket                                                                   | Tokens | Share |
| ------------------------------------------------------------------------ | ------ | ----- |
| Fixing and re-reviewing code a model wrote earlier                       | 1.55B  | 32%   |
| Building new capability (features, payments, bot, delivery, SEO)         | 1.15B  | 24%   |
| Running the shop through agents (inventory 667M, order lookups, revenue) | 833M   | 17%   |
| Plans, tooling, lint, infra                                              | 640M   | 13%   |
| Repainting the UI (brutalist, soft, sharp, soft, sorbet)                 | 597M   | 12%   |

Only about a quarter built something new. About 58% was rework or upkeep. Another 17% paid a model to be the admin UI that never got built. Subagents burned 1.22B of it, 26%, mostly reviewing each other.

## The real root cause

Mom never used the website dashboard for new arrivals, and she still doesn't. When stock arrives she posts it to Facebook as collages: 70+ images, 9 to 12 products per image, repeats included. The site's stock was synced afterwards by reading her posts, through the owner and an agent. The biggest stock session (pi, 2026-08-22 to 08-27, about 218M tokens with subagents) was a model working backwards from her marketing to the inventory. The rewrite fixes it by turning that around: the DB renders her collages. See [../KILL-THE-NOTEBOOK.md](../KILL-THE-NOTEBOOK.md#5-the-collage-comes-out-of-the-db).

## The 667M-token string

ecommerce-dashboard had a product variants table, and ecom-dashboard deleted it on 2025-01-16 in commit `570107d`, message "upd". After that, every repo stored potency, count and form inside the product name. The catalog was rebuilt from scratch at least four times:

- Feb 2026 from a JSON file
- Apr 2026 from shelf photos
- May 2026 from price list images
- Aug and Sep 2026 from pasted stock text and catalog photos

Each rebuild had a model squinting at names like "NatureBell NatureBell D3 5000IU 240" to work out what a product was. One session on 2026-08-22 used 142M tokens doing it. The fix is an ASIN column and a variant table, which LEGACY.md already asks for.

## Things built twice or more

- **Telegram admin alerts.** A stub in ecom-back in Feb 2025 (one `/start` command, Approve and Decline buttons that only edit the message text), then the real thing in Sep 2026.
- **The CORS saga.** ecom-back in Feb 2025, vit-mono in Apr 2025, vit-store on 2025-09-02.
- **Search, three times.** Upstash, then a MiniSearch Durable Object, then back to Upstash.
- **Checkout, five times in May 2026.** Session replay later showed the cause was in-app webviews, not the design.
- **Cache layers that only stack up.** KV tRPC cache, TanStack Query, Upstash, HTML s-maxage, Workers Cache, then the Astro edge cache. Only the MiniSearch Durable Object was ever removed, and the 2025 KV cache is still on main.
- **Auth.** 153 commit messages across all repos mention auth, login or sessions, and three repos ended with the auth middleware commented out.

## Money bugs found by customers, not by code

- **QPay invoice only in KV.** 739,000₮ of payments had no order link for 36 days, and a customer found it.
- **Provider flip.** Opening the transfer tab changed the payment provider, giving 2,823 "Not a QPay payment" errors for 21 users.
- **Repeated orders.** Three identical 1,121,000₮ orders in 110 seconds after a failed Facebook iOS bank handoff. The bug lived at least 51 days and took about 10 sessions to fix.
- **Live re-pricing.** Order lines were priced from the live catalog for a full year.

All of this happened while the standing rule was "dont write any fucking test ever" and there was no staging DB, so every agent fix ran against prod.

## Side quests during the fire

In July 2026 ecom-template got 429 commits in 11 days, against 263 for vit-store that month. store-kit is a kit for selling shops to other people, built while the shop's own DB could not see 97% of its sales. MANIFESTO now refuses it.

## The real sales channel was skipped

Messenger brings 30 to 40 orders a day and the website 10 to 30. The website got five checkout rebuilds, three UI identities and a summer of SEO, then a full noindex on 2026-09-09. The Messenger bot has been waiting on Meta verification since June.

## Who wrote the bugs

Agents did not cause most of this. 7 of the 12 LEGACY.md bugs were born on day one of vit-store, 2025-07-07, before any surviving session log. Back then the code came from Cursor agents, ChatGPT and DeepSeek copy-paste, and hand edits, all committed by the owner. Later models mostly carried those bugs forward, or added layers on top when asked to. The prompts decided what got built.

## What would make this rewrite different

amerik-vitamin has 8 docs, a test harness and plans for three storefronts, a reels engine and 500M₮ a month. It has zero orders. Every one of the 8 earlier repos started the same way.

One rule: build nothing else until the notebook is empty. Every order, payment, stock movement and unit cost goes into the DB, and mom writes nothing on paper for a week. Until then there is no storefront polish, no reels and no second store.
