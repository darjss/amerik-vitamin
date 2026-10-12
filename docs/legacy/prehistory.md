# Prehistory: the repos before amerik-vitamin

Nine repos from Oct 2024 to Oct 2026, all for one vitamin shop. Sonnet agents read every commit, the big diffs and the code at key points, in clones under `~/dev/scratchpad/vit-store/prehistory/`. vit-store was read from `origin/main`.

Authorship. The commit messages before 2026 were typed by the owner. The code was a mix of Cursor agents, copy-paste from ChatGPT and DeepSeek, and hand edits. Agent sessions from before 2026-01-12 were lost to a laptop reinstall, so for that period git is the only record.

The interactive version is `timeline.html`.

## Repos at a glance

| Repo                | First / last commit     | Commits | Stack                                                              | Fate                              |
| ------------------- | ----------------------- | ------- | ------------------------------------------------------------------ | --------------------------------- |
| ecommerce-dashboard | 2024-10-21 / 2024-11-25 | 4       | create-t3-app: Next, libsql, Lucia, Radix                          | Restarted as ecom-dashboard       |
| ecom-dashboard      | 2024-12-31 / 2025-04-14 | 123     | Next, Turso, Drizzle, Upstash Redis sessions, tRPC at the end      | Split into vit-mono               |
| ecom-dashboard-main | none                    | 0       | none                                                               | Empty                             |
| ecom-worker         | 2025-02-10 / 2025-02-12 | 4       | Hono on Workers, grammY, R2                                        | Copied into ecom-back             |
| ecom-back           | 2025-02-17 / 2025-02-24 | 18      | Bun, Hono, grammY, Docker                                          | Ended in CORS fixes               |
| vit-mono            | 2025-04-14 / 2025-06-25 | 100     | Turborepo, Next admin, Astro store, tRPC, Turso, Redis             | Replaced by vit-store             |
| vit-store           | 2025-07-07 / 2026-10-07 | 749     | Better-T-Stack, then Astro + Solid, Hono + tRPC, Postgres, Alchemy | Condemned by the manifesto        |
| ecom-template       | 2026-07-11 / 2026-07-21 | 429     | Astro 7, Solid, Elysia, D1                                         | Side quest, replaced by store-kit |
| store-kit           | 2026-07-22 / 2026-08-10 | 196     | Vite+, Astro, Solid                                                | Side quest, quiet since Aug 10    |

## The schema never left

ecom-dashboard's `src/server/db/schema.ts` (13 tables, last touched 2025-04-09) compared with vit-store `packages/api/src/db/schema.ts` on origin/main:

- All 13 tables survive under the same `ecom_vit_` names: user, customer, brand, category, product, product_image, order, order_detail, payment, cart, cart_item, sales, purchase.
- 82 of 85 columns survive by name. The other 3 (`purchase.product_id`, `quantity_purchased`, `unit_cost`) moved into `purchase_item`. MANIFESTO says 81 of 84, so its count is off by one.
- Dialect went from SQLite/Turso to Postgres. `deleted_at` was added to nearly every table on 2025-10-09.
- **Variants existed and were deleted.** ecommerce-dashboard had a `productDetails` variants table with price and stock per variant. ecom-dashboard dropped `sku` and `hasVariants` on 2025-01-16 in commit `570107d`, message "upd". Every repo since then guesses potency and count from product names. In 2026 agents spent about 667M tokens on catalog chores that mostly come back to that guess. A leftover still exists: `cart_item.productId` mapped to a column named `product_variant_id`.
- The phone has been the customer key since ecom-dashboard, stored as an integer. LEGACY.md bug 8 dates from here.
- `sales.productCost` storing average purchase cost at sale time is an ecom-dashboard idea. In vit-store every value is 0.

## ecommerce-dashboard

**One line:** A T3-style Next.js admin dashboard for the store, with product, brand and category CRUD. Orders were mock data.
**Stack:** Start: Next 15 canary, React 19 RC, Drizzle on libsql/SQLite, Lucia + bcrypt + argon2, shadcn/Radix, Zustand, React Query, nuqs, cheerio. The T3 README still mentions NextAuth, Prisma and tRPC, none of which were used. End adds react-hook-form, @hookform/resolvers, react-dropzone, TanStack Table and Radix toast. Drizzle went 0.33 to 0.36. Deploy target: none configured.
**What it got to:**

- 2024-10-21: 91 files, 6,075 lines in one "first commit". It had a login page, a product add form with images and variations, product table and grid views, and brand/category tables.
- 2024-11-25: a first Drizzle migration (`0000_bright_kate_bishop.sql`, 156 lines) and a rewrite of the brand, category and product screens.
  **Recurring struggles:** Only 4 commits, so little to count. Three are named "upd" or "first commit". The 11-25 commit rewrote about 4,600 lines. "fix build issues" followed it the same day and deleted the edit dialogs it had just added. The auth block ended up commented out.
  **Code reality:**
- Lucia auth is fully commented out in `src/auth.ts`. In `actions/auth.ts` the signup and signin bodies are commented out, so signup just redirects.
- Orders come from `utils/data.ts`, a static list. The order and cart tables exist in the schema (`sessionCart`, `userCart`, `cartItems`, `Payment`) but no UI uses them.
- The Amazon scraper is a server action with a copied browser Cookie header in `constants.ts`.
- The schema is dense. Every table has `created_at`/`updated_at`, indexes, a `vit_` table prefix and cascade deletes. It is well thought out for a first pass.
- The `commands` file is a pasted list of `mkdir`/`mv` lines. It is not a script.
  **Carried forward:** The `vit_` prefix. The shape brand > category > product > productDetails (variants with price and stock) > productImages with an `isMain` flag. The orders > orderDetails > payment split. The Amazon scraper, which reappears in ecom-worker and ecom-back. Drizzle on SQLite.
  **Why it ended:** After 11-25 it had no commits for months. Next came ecom-worker, which splits scraping and images into a small backend. The dashboard repo clones (`ecom-dashboard`, `ecom-dashboard-main`) are in the same folder, so the work probably moved there.
  **Best commit messages:** "first commit", "upd", "fix build issues"

## ecom-worker

**One line:** A 4-commit Cloudflare Worker (Hono + grammY + cheerio + R2) that was the first try at splitting the backend out of Next.
**Stack:** hono, grammy, cheerio, nanoid, wrangler 3, an R2 bucket binding. Deploy target: Cloudflare Workers.
**What it got to:**

- 2025-02-10: a Telegram bot with a webhook, an Amazon search and detail scraper (262 lines), and `/send-message`.
- 2025-02-12: image upload to R2.
- Nothing shows it ever fully ran. The last commit does not compile.
  **Recurring struggles:** Image upload took 2 commits in one day and never ended in working code. The R2 public URL was guessed twice. First it was the S3 API host, then the invalid expression `https://${bucket.}.r2.dev/`.
  **Code reality:**
- A real Telegram bot token is committed in `wrangler.json` in `f865ba4`. The key is also misspelled as `"TELEGRAM _TOKEN"` with a space, so the Worker could never read it. The `Env` type expects `TELEGRAM_TOKEN`.
- `ADMIN_CHAT_ID` is a hardcoded constant.
- `/scrape/search` is an empty handler.
- A stray `time: uploadTime.toFixed(2)` sits after the `return`, which makes it a dead label.
  **Carried forward:** `scrape.ts`, `telegram.ts` and `constants.ts` were copied unchanged into ecom-back. The first-commit diff has the same 262-line scrape.ts.
  **Why it ended:** Workers have no Bun S3 client and bad R2 URL handling, and the last commit breaks the build. Five days later the same code started again as ecom-back, a Docker/Bun server.
  **Best commit messages:** "image upload", "fix image"

## ecom-back

**One line:** A Bun + Hono server in Docker for scraping, R2 image upload, and an admin order-approval bot.
**Stack:** Start: hono, grammy, cheerio, nanoid, zod, firecrawl, @upstash/redis, @oslojs/crypto and encoding. Docker image `oven/bun`. End adds the `cors` middleware.
**What it got to:**

- 2025-02-17: first deploy (Dockerfile + GitHub Action that pushes `darjs/ecom-back` to Docker Hub).
- Same day: Redis session auth, with the token SHA-256 hashed, a 30-day session and refresh after 15 days.
- 2025-02-24: `/upload/image` and `/upload/image/urls`, which fetch images by URL in parallel and store them in R2 via `Bun.S3Client`, returning a public `r2.dev` URL.
  **The Telegram admin bot, as it actually was:**
- Commands: only `/start`. It replies "Welcome! Your chat ID is: <id>" so the admin can read their own chat ID.
- Inbound: `POST /telegram/webhook` runs `webhookCallback(bot, "hono")`. `/set-webhook` and `/delete-webhook` manage it.
- Outbound: the storefront calls `POST /send-message` with `{productName, totalPrice}` only.
- The bot sends an HTML message to the single hardcoded `ADMIN_CHAT_ID`. It reads "New Order Received", then Product in italics and Total Price in code format, then "Please review and take action:".
- Buttons: an inline keyboard with "Approve" and "Decline" on separate rows. Callback data is `approve` or `decline`.
- On a tap, it calls `answerCallbackQuery` ("Order approved" or "Order declined"). It then edits the message to "Order has been approved." or "Order has been declined."
- Nothing is stored. There is no order ID in the callback data, no database write, and no customer notification. The buttons only change the message text, and there are no other commands or states.
  **Recurring struggles:** CORS took 4 commits on 2025-02-24 ("fixing cors", "fixing cors final", "fixing cors final final"). The GitHub workflow folder was renamed 3 times in 3 commits (`.gihub`, `workflows.yaml`, `workflows/docker-push.yml`). Auth was added in 5 commits on 2025-02-17, then disabled the same day. Deploy fixes ran 3 commits.
  **Code reality:**
- `.env` was committed in the first commit, with the Telegram token and the R2 keys. "remove env lol" only added it to `.gitignore`, so it stays in history.
- `imageUploader` logs the R2 access key and secret to the console.
- The auth middleware (Redis session or IP allowlist) is commented out in the final `index.ts`, so every route is open. CORS origins include the placeholder `https://your-frontend-domain.com`.
- `uploadImageFromUrls` reads `c.env.BUCKET`, a Worker leftover, though it is unused.
- The public R2 URL is hardcoded.
  **Carried forward:** The Approve/Decline order-alert idea, a Telegram chat for the shop admin. Bun/Hono API shape. R2 image upload by file or by URL. Amazon scrape. This is the same idea that returned in vit-store in Sep 2026, but this version is only a stub.
  **Why it ended:** The last commit is 2025-02-24 "fixing cors final final". There are no later commits and the auth is off.
  **Best commit messages:** "first commit deploying", "remove env lol", "fix github actionthird attempt", "disable auth for testing", "deploying again???", "fixing cors final final"

## ecom-dashboard

**One line:** An admin dashboard for a vitamin shop. It covered products, orders, purchases and analytics, behind Google login. It had no public storefront.

**Stack:**

- Start (2024-12-31): create-t3-app scaffold with Next 15, React 18, Turso (libsql), Drizzle 0.33, zod, Tailwind 3.
- End (2025-04-14): Next 15.3 canary, React 19 canary, React Compiler, Drizzle 0.38, tRPC 11 with react-query and superjson.
- Auth: arctic for Google OAuth, oslojs for session hashing, Upstash Redis for sessions and an analytics cache.
- UI: shadcn/Radix, recharts, nuqs, react-hook-form, sonner.
- Added then removed: uploadthing (removed 2025-02-17, but `@uploadthing/react` is still in package.json), cheerio Amazon scraper (left as a fully commented-out `scrape.ts`), T3 `env.js`, which was deleted in the 2nd commit.
- Deploy: Vercel (speed-insights) with prod Turso. Separate dev and prod drizzle configs. Dev uses a local `dev.db` file.

**What it got to:**

- 2024-12-31 to 2025-01-01: Google OAuth, rate limiter and Redis sessions.
- 2025-01-08 to 01-30: first full schema.
- 2025-02-19: add-order flow.
- 2025-02-25: image upload.
- 2025-03-07 to 03-10: order grid, purchase CRUD, brand CRUD and category CRUD, all in one 4-day burst.
- 2025-03-11 to 03-19: sales and analytics backend, with charts on the home page.
- 2025-03-24: Redis cache for analytics.
- 2025-04-10: cursor pagination on products, orders and purchases.
- 2025-04-14: tRPC added, but the only router is a `cart` stub that says hello.

**Recurring struggles:**

- Auth: 32 of 123 commit subjects mention it. There were 9 "fix auth middle*" commits on 2025-02-23 alone. Others were "auth fix?", "auth no cache", "rever auth changes", "add more auth logging", and "fix redis json parse" on 04-09. Spread over about 3 months.
- Generic "upd": 24 commits.
- Build or type errors: 13 commits.
- Seeding: 6 commits.
- Pagination: several attempts, ending in a rewrite.

**Code reality:**

- Auth is half-built. The middleware's session check is commented out, so GET requests pass without a login. The whole middleware is skipped in development. It also logs raw session tokens with `console.log`.
- Session storage has bugs. `insertSession` writes with `redis.json.set`, `getSession` reads with `redis.get`, and `updateSession` writes under the wrong key. That mismatch likely explains the many auth fixes. It also stores the whole user object inside the session.
- `addOrder` and `seedOrder` are copy-pasted. `addOrder` ends with `redirect()` inside a try/catch, and it hardcodes the payment provider to "transfer".
- Server actions repeat the same try/catch that returns `{message, error}`. Many `console.log` calls and unused imports are left in. There are no tests.
- The schema, however, is good: normalized, with indexes, enum constants and transactional writes. It is the best part of the repo.

**The schema**

- Prefix: tables use `ecom_vit_*` (changed from `ecommerce-dashboard_` on 2025-02-21).
- Final table set (14):
  - users
  - customers
  - brands
  - categories
  - products
  - product_images
  - orders
  - order_details
  - payments
  - carts
  - cart_items
  - sales
  - purchases
- Types: SQLite ints for money in whole tugrik, and `int` timestamps defaulting to `unixepoch()`. Enum columns come from `constants.ts`.
- Early drafts had `sku`, `hasVariants` and `product_variant_id`. Variants were dropped 2025-01-16. A leftover remains: `cart_item.productId` is still mapped to the column `"product_variant_id"`.
- Customers: the primary key is the phone number, an int, after trying text first. Orders point to `customerPhone`. A customer has only a phone and an address.
- Users: google_id (unique), username, and an `is_approved` flag (default false) as the admin allowlist.

**Auth model**

- Login is Google only. The user is created unapproved. Sessions are random tokens stored as a sha256 hash, with a 30-day expiry that renews when under 30 minutes remain. Redis is the store, with a `user_sessions:<id>` set.
- There is no DB session table. The Lucia-style pattern comes from the oslojs guide.

**Order model**

- `order`: has an 8-character `orderNumber`, a status enum (pending, shipped, delivered, cancelled, refunded), a copy of the address, a `deliveryProvider` enum (tu-delivery, self, avidaa), an integer `total` and `notes`.
- `order_detail`: holds only productId and quantity. It does not store a price snapshot.
- `total` is computed in application code.

**Payment model**

- `payment` is a separate row per order with `provider` (qpay, transfer, cash) and `status` (pending, success, failed).
- Stock and `sales` rows are written only when `paymentStatus === "success"`, inside the order transaction. The `qpay` enum value was never wired to anything.

**Purchase model**

- `purchase` is one row per product: `quantityPurchased` and `unitCost`. A new purchase adds to `product.stock` in the same transaction.
- `sales` rows copy the average purchase cost, `productCost`, at the time of sale. They also store `sellingPrice` and `discountApplied`. This is how profit analytics worked.
- Nothing links a purchase to a supplier, a shipment or a batch.

**Carried forward:**

- The `ecom_vit_` prefix, the `createTable` helper and the table names survive. vit-store (origin/main, `packages/api/src/db/schema.ts`) still has user, customer, brand, category, product, product_image, order, order_detail, payment, cart, cart_item, sales and purchase. It moved from SQLite to Postgres with `generatedAlwaysAsIdentity` and `deletedAt` columns.
- The enum lists (status, orderStatus, paymentProvider, paymentStatus, deliveryProvider) still live in `lib/constants`, now in `@vit/shared/constants`.
- vit-store changes it later:
  - Customers get a surrogate `id` (phone is still unique), plus social usernames and an address zone.
  - Brands and categories get slugs, SEO fields and banners.
  - Purchases gain `purchase_item`, `purchase_receipt` and `purchase_receipt_item`.
  - New tables for payment notifications, bank-transaction dedupe (khaan) and restock subscriptions. Messenger failure logging also appears.
- Google login with an `is_approved` gate, the same product fields, the sales-with-cost analytics idea, and the shadcn dashboard.

**Why it ended:** The last commit is 2025-04-14 ("add trpc"), and it only adds scaffolding. The pattern suggests a rewrite as a monorepo with a separate API and storefront. I did not read the next repo, so that part is unconfirmed. The evidence here is 3 months of auth fighting and server actions that could not be shared with a storefront.

**Best commit messages:**

- "fix auth middle" (x4 in a row)
- "trying to fix google oauth"
- "overhaul ui neobrutalist"
- "auth fix?"
- "rever auth changes"
- "overhaul grids redesign purchasescursor based pagination for all"

Repo path: `/home/darjs/dev/scratchpad/vit-store/prehistory/ecom-dashboard`. The schema is at `src/server/db/schema.ts`.

## vit-mono

**One line:** The first Turborepo for the shop. It had a Next.js admin dashboard and an Astro storefront, with a shared tRPC API and a shared database package.

**Stack:**

- Start (2025-04-14): the shadcn monorepo template with pnpm, turbo and TypeScript.
- Admin (`apps/dash`) at the end: Next 15.4 canary, React 19 canary, tRPC 11, TanStack Query, Drizzle, libsql/Turso, better-sqlite3, Upstash Redis, arctic (Google OAuth), oslojs, uploadthing, recharts, nuqs, react-hook-form. It deployed on Vercel.
- Storefront (`apps/store`) at the end: Astro 5.8 SSR with React islands, Tailwind 3, tRPC, motion and input-otp.
- Packages: `@vit/api`, `@vit/db` and `@workspace/ui`.
- Adapters: `@astrojs/vercel` (added 04-18), then `@astrojs/cloudflare` (04-22). `@astrojs/vercel` and `@astrojs/node` were never removed from package.json.
- Docker Redis scripts were added for local dev.

**What it got to:**

- 04-14: monorepo, admin, Astro app, and db and tRPC packages, all in one day.
- 04-16 to 04-21: product CRUD in the admin, a landing page, a product page, and a localStorage cart ("cart functionality basically done", 04-21).
- 04-22: the storefront deployed to Cloudflare Workers.
- 05-06: checkout form, address form, and a payment screen with two options, bank transfer to Khaan Bank and QPay.
- 05-31 to 06-12: phone OTP login for the storefront, with the OTP stored in Redis and a `store_session` cookie. Cookie auth was "done" on 06-12.
- The admin also had Google login, orders, purchases, analytics charts, and an Amazon scraper.

**Recurring struggles:**

- Build and deploy fixes: about 32 commits. The worst runs were "fix build" x1 to x6 on 05-23 and 05-25, and "fix build again" with up to 7 "again"s on 05-31 and 06-01.
- CORS and cookies: about 11 commits. Cookie config was still being tested on 06-25.
- Auth: about 11 commits. Auth was rewritten from Astro actions back to tRPC on 06-19.
- Next.js type errors: about 6 commits.
- Adapter changes: Vercel, then Cloudflare, then workarounds for Cloudflare.

**Code reality:**

- Cart:
  - The cart is client-only localStorage with a custom event bus (`cartUpdated`) and no server cart.
  - `packages/api/src/router/cart.ts` is still the tRPC template `hello` stub with commented-out post code.
- Payment attempts:
  - `payment.ts` is an empty router.
  - The QPay button links to `/qpay`, which is never built.
  - The transfer screen hardcodes the bank account, company name and a fake reference ("20250507-014445").
  - The schema has a `PaymentsTable` with `qpay`, `transfer` and `cash`, but no attempt or invoice fields.
- `createOrder` bug:
  - The transaction result is never returned (`await db.transaction(...)` with no `return`), so the client gets `undefined`.
  - It trusts the client-sent `total` and prices.
  - It always uses delivery provider `tu-delivery`.
  - Stock is never decremented.
  - There are `console.log` calls everywhere.
- Auth:
  - The OTP is only logged, and SMS sending is commented out.
  - In `development` mode any OTP is accepted.
  - A Basic-auth SMS gateway credential is committed in a comment.
  - tRPC context logs the raw cookie header and session token.
  - `dev.db` (SQLite) and `tsconfig.tsbuildinfo` are committed.
- Build breakage:
  - `astro.config.mjs` ended up with a large hand-written rollup `external` function and `noExternal` hacks.
  - It aliased `@vit/api` and `@vit/db` straight to their `src` folders.
  - It swapped `react-dom/server` for `.edge` in production.
  - The workspace packages ship TypeScript source and Node-only deps (`better-sqlite3`, redis) into a Workers bundle, and the build kept failing for that reason.
  - Mixed React canaries, a Next canary, a pnpm `catalog:`, and a `workspaces` field next to `pnpm@10` also added to the breakage.
- Good ideas: the Drizzle schema (customer keyed by phone, order, order detail, payment) and the shared `@vit/api` router package.

**Carried forward:**

- The phone number as customer identity (`CustomersTable.phone` as primary key) and OTP login.
- The schema entities: brand, category, product, product image, order, order detail and payment. The enum values `qpay`/`transfer`, `tu-delivery`/`avidaa`, and order statuses `pending`/`shipped`/`delivered` carry forward.
- The `@vit/api` and `@vit/db` package names (vit-store uses `@vit/api` too).
- The Astro storefront plus tRPC and Cloudflare Workers, and the Turso/Redis split.
- The Mongolian copy, the Khaan Bank transfer and QPay flow, and the Amazon scraper.

**Why it ended:**

- The last commits are cookie tests, "remove extra routes" (06-25), and "cookie config test again".
- The repo had no clean exit. Auth still could not work cleanly across the dashboard and the storefront domains, and the build was still fragile.
- The history shows no clear next-repo evidence, so I did not look beyond this repo.

**Best commit messages:**

- "fix build again again again again again again again again"
- "help x2"
- "fixing cors issues?"
- "auth done?"
- "trying to fix nextjs type errors 3"
- "cookie config test again"

## vit-store, the lost era

**One line:** An import-vitamin store for Mongolia (amerikvitamin.mn). It was built as a Cloudflare monorepo with an admin dashboard, a tRPC API and a storefront, and it went through repeated stack swaps.

**Stack:**

- **Start (2025-07-07, repo name `vit2`):**
  - Better-T-Stack scaffold (`bts.jsonc`), with Bun workspaces, Turbo and Biome.
  - TanStack Start dashboard (`apps/dash`), Astro store (`apps/store`), and a Hono + tRPC server on Cloudflare D1.
  - Drizzle ORM and zod.
- **End (2026-01-13):**
  - `apps/admin` is a TanStack Router React app, from the 2025-08-05 migration.
  - `apps/storev2` is Astro 5 with Solid islands, TanStack Solid Query and Form, and Astro images with unpic.
  - `packages/api` is a Hono + tRPC server with valibot and drizzle-valibot.
  - `packages/shared` holds types and utilities.
  - The database is PlanetScale through a Cloudflare Hyperdrive binding.
  - Deployment is Alchemy v0.83, up from v0.70.
- **Added then dropped:** zod, TanStack Start, D1 and Wrangler configs, and `better-sqlite3` (used for local dev).

**What it got to:**

- 2025-07-07/08: auth, tRPC routers and a login UI.
- 2025-08-05: moved from TanStack Start to TanStack Router.
- Aug to Oct: admin CRUD for brands, products, categories, orders and customers, with search and pagination.
- 2025-09-10: rate limiting, then a retro UI overhaul on 09-11.
- 2025-10-13: tRPC cache middleware, then an analytics page.
- 2025-10-23 onward: storefront with cart, checkout and a payment page.
- 2025-11-11: Messenger webhook that sends transfer notifications.
- 2025-11-12: PlanetScale migration.
- 2025-11-21: real seed data.
- 2025-12: search, Iconify icons, SEO and analytics.

**Recurring struggles:**

- **Lint fixes and WIP commits:** many commits are "fix lint", "fix", "wip" or "upd".
- **CORS:** 6 commits on 2025-09-02 ("trying to fix cors error", "redeploy fix cors again").
- **Auth:** "auth done fully" appears twice in one day (08-02), then "auth done?" on 08-05 and "fix login error hopefully?" in October.
- **Hydration and SSR:** "tried to fix ssr rendering issue" (08-05), a Solid storage patch (10-29), and "fixed hydration issues" (11-11).
- **Deploy tooling:** Alchemy was adopted on 10-20, redone as "alchemy v2" on 11-10, and upgraded to v0.83 for Hyperdrive on 01-13.

**Code reality:**

- The first commit was 22,025 lines across 90 files, mostly scaffold, and it already had a full schema with payment, delivery and order tables.
- `.alchemy/` logs and local worker output were committed, then cleaned up in `053d280`. `87b9f11` fixed `.gitignore` to stop tracking `.env`. `apps/storev2/.env.dev` was committed on 4 dates from 10-29 to 11-10. I did not check its contents.
- The cache middleware (`169cc48`) builds a SHA key from the path and input with a lot of `unknown` casts, and it has `console.log` left in.
- The Messenger verify route logs the verify token next to the env value (`console.log("verifyToken", verifyToken, "env", ...)`).
- Routers wrap everything in `try/catch` and rethrow `TRPCError`. This is repetitive but consistent.
- The owner's own first deploy cleanup shows `apps/web` and old dashboards being deleted. Big rewrite commits show net deletions (`d5e4446`: +2,692/-10,762; `18be657`: +7,821/-11,262).

**Soft delete:** `7638d1d` (2025-10-09) added `deleted_at` columns and indexes to products, brands, carts and cart items.

**Payments:**

- There is no QPay API code in this window.
- The schema had `paymentProvider` and `paymentStatus` enums from day one.
- `qpay.png` and `khaan.png` logos were added to `apps/storev2/public` on 11-11.
- The `payment/[id].astro` page shows a bank transfer account (`transferAccount.accountNumber`, `accountName`). A "confirm payment" button then triggers the Messenger `sendTransferNotification`.
- Payment is manual bank transfer with a notification, not an integrated gateway.

**Carried forward:**

- The `ecom_vit_*` table prefix and Drizzle schema.
- The `packages/api` and `packages/shared` split.
- Valibot with `drizzle-valibot`.
- tRPC with Hono.
- The Messenger webhook path `/messenger/webhook`.
- Soft delete via `deleted_at`.
- Alchemy `alchemy.run.ts` files.
- `todo.md` and `seed.sql`.
- The storev2 Astro + Solid storefront.

**Why it ended:** It did not end. The era closes on 2026-01-13 with Hyperdrive and local DB fixes. Later work (the fix commits around Telegram alerts, Flue and the agent) builds on this same stack.

**Best commit messages:**

- "migrated to tsrouter instead of tsstart :) so much simpler"
- "remove old tanstack start dashboard :)"
- "auth done fully fix env trpc fix https in dev with caddy"
- "migrate from zod to valibot new shared package lint errors deployment with alchemy success"
- "fixed hydration issues added messenger bot and migrated to queries architecture"
- "add loggin trying to fix cors error 2"
