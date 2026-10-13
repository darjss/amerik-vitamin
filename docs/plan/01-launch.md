# Milestone 1: launch

Done when a real customer orders on the pilot page, pays by QPay, the order shows in the dashboard, TU delivers it and the webhook marks it delivered, mom's main-page chats turn into orders by themselves, and vit-store takes no more orders.

Terms are in [GLOSSARY.md](../../GLOSSARY.md). Hard-to-reverse calls are in [docs/adr](../adr). Delete each tier from this file when it ships.

## Decisions from the grilling (2026-10-12 to 10-13)

These are settled. Don't reopen them without the owner.

- **Catalog.** One flat row per SKU ([ADR 0003](../adr/0003-flat-products-no-variants.md)), rebuilt from mom's collages ([ADR 0002](../adr/0002-rebuild-catalog-not-import.md)). Stock starts unknown (`null`) and gets a number at the first count or receipt. A null-stock product sells freely with no oversold pings.
- **Collage reading.** An Effect script sends each collage image to gpt-6-luna and gets tiles back: brand, line, potency, count, form, flavor, price. The prices on the image are selling prices ("130k" is 130,000₮). Then dedupe by identity key, search Amazon for the ASIN and images, review on a page, and load. The owner drops the 70+ images in `~/dev/scratchpad/amerik-vitamin/collages`.
- **Legacy migration.** Customers, orders, lines and payments all migrate. Every order line gets matched to a new product: by script first, then the agent matches the rest by hand. Pending orders become cancelled, and shipped ones become delivered.
- **Customers.** A TypeID per customer, and phone is the key. Only people who order are stored. People who only chat live in the bot's state.
- **Order number.** Plain digits, `#10234`, also used as the bank-transfer reference.
- **Chat orders** ([ADR 0005](../adr/0005-chat-orders-created-automatically.md)). The main page connects to Zernio in watch-only mode. A model creates orders from agreed chats with no confirm step. Each one starts as `new` and COD unless the chat shows a transfer, and Telegram posts it with a 24h [undo].
- **Telegram** carries the admin AI and the notifications. The AI acts on its own and every write gets an [undo]. It never records a payment or moves money. Its tools are the same API calls the dashboard uses.
- **Models.** gpt-6-luna for everything, through vit-store's `cli-proxy-api` on orc-box for now. Production moves to a real OpenAI key later.
- **Amazon** ([ADR 0004](../adr/0004-amazon-via-owner-cookies.md)). It runs on the owner's cookies, pasted once into dashboard Settings and stored encrypted. A small TS scraper on Workers borrows `amazon-orders`' selectors, with no fallback if Amazon blocks Workers. Reorders check out fully after a tap in our UI. The tap screen shows Amazon's real cart and total, and anything over $1,500 is refused.
- **Dashboard access.** An allowlist of Google emails with no roles. It deploys to prod early, behind Google login, and runs in shadow mode.
- **Storefront.** A full rebuild with a new look, on Solid 2 server components plus Workers Cache. The 30k lines of Astro are reference only. Checkout never asks for login. Phone-OTP login stays, but it's optional and built last.
- **Tests.** One commerce-rule test file, Amazon parser parity against upstream's saved HTML pages, and the bot's 145-case eval harness ported from vit-store #343.

## Tiers

Build in this order. Inside a tier, independent pieces run in parallel worktrees.

### T1. Data in

- **Schema v2.** Products (flat, identity key, unique ASIN, nullable stock), customers, orders, order lines, payments, `order_events`, stock moves, bank transactions, outbox, supplier orders and lines, delivery zones. Commerce functions follow COMMERCE-RULES. Done when the commerce-rule test file passes on local Postgres and prod runs the migration.
- **Catalog from collages.** Done when every product in the latest collage set has one row, there are no identity duplicates, each has an ASIN and images on R2, and the owner has reviewed it.
- **Legacy migration.** Done when the reconciliation report matches vit-store's own SQL counts and totals, and every old order line points at a product.
- **First prod deploy** of API and web.

### T2. Orders flow in

- **Payments.** QPay invoice, check and callback. Khaan via `khaan-client`, with the unmatched-transfer inbox. Done when a real QPay payment and a real transfer both land, and replaying either changes nothing.
- **Telegram notifications** through the outbox: new order, paid order, unmatched transfer, oversold, chat order with [undo].
- **Chat orders** from the main page. Done when a day of mom's real chats produces the orders she would have written, and every [undo] works.
- **Dashboard v1.** Orders inbox with timeline and actions, products (price, stock, images, archive, catalog review), one-line manual order with COD, and Amazon cookies in Settings. Done when mom runs a real day on her phone.
- **Amazon tracker.** Daily cron, supplier orders and lines by ASIN, Telegram ping when the cookies expire. Done when the last 30 days of real orders show with an ASIN on every line.

### T3. Bot

- **Bot port.** `apps/messenger` from vit-store, rewritten in Effect on executor-v2's pattern: handoff state machine, one open order per chat, prepay only, pilot page only. Done when the eval set passes at its old rate and a real pilot order completes.
- **Telegram admin AI.** It acts with [undo]. Done when the owner can find an order, change a price and confirm a stock count from Telegram.

### T4. Delivery and reorder

- **TU.** v3 dispatch, the webhook sets `delivered`, and the zone list is cached daily. Zone matcher: the customer's last zone, then district and khoroo parsing plus aliases, then Luna picking from TU's list. Mom confirms at dispatch. Done when a real parcel goes out and comes back delivered.
- **Reorder.** Sales velocity gives a buy list, the owner approves it in our UI, and a one-tap Amazon checkout runs under the $1,500 cap.

### T5. Storefront

1. **Server-components gate.** One real product page on then-current versions has to pass: a 404 and a single-hop 301 from the route, canonical, meta and JSON-LD in the HTML, a sitemap, and a Cache-Tag hit then purge then miss. If it fails, fall back to plain SSR.
2. **Look.** Three throwaway prototypes of the product page and checkout: one in today's colors and two new directions. The owner picks one.
3. **Pages.** Home, brand and category lists, product, search, cart, checkout (QR first in Facebook's in-app browser, plus transfer), the order page looked up by phone, and the static pages. It stays noindexed until the relaunch.
4. **Optional phone-OTP login,** last.

### T6. Cutover

Point the Zernio, QPay and TU webhooks at the new Workers, migrate the delta since T1, turn off vit-store's checkout and admin, and drop the `ecom_vit_*` tables after a week with no surprises.

## Blocked on the owner

- The 70+ collage images (T1).
- The Zernio pilot-page key, and the main page connected in Zernio (T2, T3).
- The Amazon cookies (T2).
- The TU v3 API spec and our webhook registered with TU (T4).

## Not in M1

The brand sites, the SEO relaunch, reels, reorder reminders, stock lots with expiry, the dashboard AI panel and Phase B receiving by scan.
