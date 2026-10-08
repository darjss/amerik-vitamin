# What I asked agents to do on vit-store (Jan to Sep 2026)

Input for the rewrite. Mined from 1,044 agent sessions in 8 harnesses: opencode, devin, bpi, pi, codex, cursor, claude code, droid. Sessions run from 2026-01-12 to 2026-09-24. The store went public in May. Fun stats are in `stats.html` next to this file.

How it was made: one extractor per harness turned raw transcripts into one JSONL shape. Six Sonnet agents then read every human prompt (4,742 of them) plus the first prompt of each subagent session, tagged each session, and wrote a chunk summary. This file merges those summaries with `CONTEXT.md`, the ADRs, and git history. Quotes are the owner's own words, typos kept.

Caveats. The project started in July 2025, but a laptop reinstall wiped all agent sessions before January 2026, so this history starts there. That early code came from Cursor agents, ChatGPT and DeepSeek copy-paste, and hand edits. Only the commit messages were clearly typed by hand. Claude Code transcripts were auto-deleted, so only its prompt history (49 sessions, 366 prompts) survived, with no token counts. Cursor stores almost no token counts. Tags on orchestrated subagent sessions are rough.

---

## 1. The business in one page

- **What it is.** Amerik Vitamin (amerikvitamin.mn). It sells imported US supplements to people in Mongolia. Brands include NatureBell, Micro Ingredients, Nutricost, NOW, Doctor's Best, Nordic Naturals, Carlson, Mary Ruth, Codeage and FarmHaven. It is the owner's mother's store. The catalog has about 420 to 526 products. All UI copy is in Mongolian and all prices are integer MNT.
- **Who buys.** Everyone is in Mongolia and almost everyone is on a phone ("99% mobile"). Most traffic comes from the Facebook and Instagram in-app browsers, which break checkout in many ways. "all current sales are through fb, no organic."
- **Sales channels.**
  - Messenger brings 30 to 40 orders a day through the main page (23k followers). Customers send a photo or a product name, an admin replies with a photo and price, and the customer replies with phone and address.
  - The website brings 10 to 30 orders a day. The owner wants this to become the main channel.
  - Phone orders arranged ahead of time.
- **Sourcing.** Products come from Amazon US and iHerb through a US supplier ("the CEO of vitamins") and a forwarder. A shipment is priced by weight. One planned shipment was 304 to 340 kg on a budget of about 8,000 USD, and it favored heavy items. The supplier sends Excel sheets with unit prices. Stock then arrives as pasted Mongolian chat text full of slang ("tom", "bor", "uut", "har ur").
- **Pricing.**
  - There are no sales or discounts ("we dont have sales at all").
  - The owner wanted a price formula: USD price × exchange rate + weight-based shipping + margin, rounded to 5,000. It was never settled.
  - Printed price sheets are newer than the DB and win when the two disagree.
  - Price changes are rare.
- **Payment.**
  - QPay: invoice, QR and bank app deeplinks, confirmed by webhook.
  - Bank transfer to a Khan Bank account. A Durable Object polls Khan through the owner's own `khaan-client` and matches each transfer by payment number and amount.
  - Social Pay (Golomt) as a deeplink.
  - Sono (BNPL) shows in the UI, but the store is not approved for it.
  - Screenshots are never accepted as proof ("abusable").
  - Most paid orders go through QPay.
- **Delivery.**
  - Delivery is next day. There is one courier run a day at about 11:00 Ulaanbaatar time, and orders placed before the cutoff go out the same day.
  - Courier is "TU" (dalai.cloud / Misco API, moved to v3 in August). TU has its own zone list.
  - The fee is 6,000 MNT. Chat orders were historically charged 5,000, with the store eating the 1,000 difference.
  - Countryside orders go by bus cargo ("unaand tavij ugnu").
  - Admins print labels on a Phomemo M110 by copying data by hand.
- **Rules about the customer.**
  - There are no returns or refunds.
  - Customer service is by phone or Messenger.
  - The customer is identified by an 8-digit phone number starting with 6 to 9.
  - Most customers check out as guests. Login is by phone plus a 4-digit OTP.
- **Staff.** The owner plus at least one other admin. That admin sends orders and stock updates over Telegram and handles 20 to 30 orders at a time on an iPhone or iPad.
- **Side ambitions.** A second small page and domain for Micro Ingredients and NatureBell. The owner also wants to sell the stack as an ecommerce setup to other Mongolian merchants, to compete with Zochil.

## 2. Business rules the code must enforce

These came up again and again. Several were relearned by agents many times because nothing in the code holds them.

1. **Product identity.** Same brand and formula with a different potency, count, size, form or flavor is a different product. Same brand, potency and count with a similar name is a duplicate. Agents ran this rule through at least five dedupe passes because it lives only in prompts.
2. **Stock moves only when a payment is confirmed.** It never moves at order creation, and unpaid orders never hold stock (issue #122).
3. **Confirming a payment happens once, in one transaction.** It records the consumed bank transaction or QPay event, sets the payment status, takes the stock and writes the sale. After the commit it purges caches and sends notifications. QPay and transfer use the same function: "no second stock/sales path".
4. **One bank transaction confirms at most one payment.** This is enforced by a fingerprint ledger.
5. **An out-of-stock product cannot be bought.** One product got an order after the admin set it out of stock (07-26).
6. **The cart allows at most 5 of a line,** whatever the stock.
7. **The delivery fee is added by the backend,** never by the client or the bot. It is 6,000 MNT.
8. **The delivery zone is chosen by an admin at dispatch.** It is not chosen at checkout since 2026-08-05, after TU's zone list outage broke checkout. Messenger may still collect a zone the customer confirms.
9. **A stock intake sets stock to the counted number.** It does not add to the old stock (the owner reversed the add idea). Drafts that get stock become active. Products missing from the current catalog photos get stock 0.
10. **Out-of-stock products stay visible** with "notify me". The storefront shows "few left" with no number. Each person can hold at most 5 active restock subscriptions.
11. **Brands with no active products are hidden.**
12. **The bot does not claim a product cures anything.** It skips the heavy "see a doctor" lines. A short caveat is used only for children, pregnancy and medication cases. Questions about expiry or restock dates go to a human.
13. **Admin alerts go out only for paid orders.** Transfer claims get their own message. If an alert fails, the customer never sees an error.
14. **Unpaid orders by the same phone for the same cart reuse the open payment.** They do not create a new order. A customer once made three identical orders of 1,121,000 MNT in 110 seconds.

## 3. Domain model the new design needs

Entities that came up, ranked by how often sessions touched them: product 280, order 165, payment 128, brand 61, product_image 48, customer 37, stock 34, category 27, cart 21, delivery_zone 20, price 17, dispatch 14, khaan_transaction 12, purchase 8, weight 8.

### Catalog
- **Product and variant.** This is the biggest miss in the current schema. Today potency, count, form and flavor live inside long Amazon titles, so dedupe, stock matching and the bot all guess from strings. "the db amount fields are fucked/wrong for now the real truth is in product name or image." The new model needs structured fields:
  - brand
  - formula or line
  - potency value and unit
  - count and form (capsule, softgel, powder, gummy, liquid)
  - flavor
  - weight in grams, for shipment planning
  - the Amazon ASIN or source URL
  - an English name and a Mongolian name
  - a cleaned display name generated from the fields
- **Product status.** One state field. Today `status` and `deleted_at` disagree (one product was active and soft-deleted since June 23).
- **Slugs.** Short and stable, with the old slugs kept for redirects. Today they run to 196 characters and repeat the brand name.
- **Images.** Self-hosted on R2, never Amazon URLs. Each image needs a primary flag, a source, a status, and a background-removed version for the social media manager.
- **Brand.** Needs a logo (37 brands had a placeholder logo that served HTML) and a merge history ("microingredients" and "micro ingredients").
- **Category.** Mongolian name, banner, description and SEO fields. "Ерөнхий Витамин" became a dumping ground.
- **Price history.** Today there is none, and price disputes were settled by hand.

### Stock and supply
- **Stock lots, with expiry per lot.** Today there is one quantity and one optional `YYYY-MM` expiry per product, and most products have no expiry. That is why the bot can't answer "when does this expire".
- **Stock movements.** Each movement needs a reason: shipment received, sale, manual set, catalog sync zero, or correction. Today stock is overwritten with no history.
- **Shipment.** Supplier, the forwarder steps (ordered, shipped to forwarder, received, cancelled), total weight, one shipping cost for the whole shipment, partial receipt, and lines with unit price in USD. Purchase tables exist but were never used as a workflow. The owner used Excel and pasted text instead.
- **Landed cost per unit.** It feeds the price formula.

### Customers and orders
- **Customer.** Keyed by phone. Also holds the Messenger PSID (per Page), Telegram id for admins, saved addresses (free text plus district, khoroo, building, door number and landmark), and the Facebook and Instagram usernames already in the table.
- **Order.** Order number (8 characters, like `P3H9FPZF`) and channel (web, messenger, phone, admin). Lines with the unit price frozen at order time: a nullable price column was only added in migration 0014, and before that orders were re-priced from the live catalog. Also the delivery fee charged, notes, the zone chosen at dispatch, and the date the label was printed.
- **Order status.** A real state machine with history. Today "created" was added late to hide unpaid orders, the admin could not tell paid from unpaid, and three paid orders never showed in the admin list.
- **Checkout or cart identity.** It links the browser session, the cart contents and the open payment, so a retry reuses the existing order.

### Payments
- **Payment.** Provider (qpay, transfer, socialpay, sono), amount, payment number (like `U2ELMVXSAL`), and a status in the DB from the moment it is created. Today the QPay invoice lived only in KV, so four webhooks found no invoice and 739,000 MNT of paid orders were left unlinked.
- **Payment events timeline.** QPay webhook, Khan transaction matched, customer claimed transfer, admin confirmed, failed. This is the "is this paid" screen the owner keeps asking agents to rebuild.
- **Unmatched bank transactions inbox.** For money that arrived but did not auto-confirm. This happened on 2026-09-08.
- **No silent provider switching.** Clicking the transfer tab flipped a paid QPay payment to transfer, which caused 2,823 "Not a QPay payment" errors.

### Delivery
- **Delivery zone.** TU zone id, name, aliases and landmarks, cached locally so checkout never depends on TU being up.
- **Dispatch.** Request and response payloads stored on the row, a status, retries, and a claim key against double sends. Today the owner reads Axiom to see what was sent to TU.

### Messaging and notifications
- **Notification outbox.** One row per event and channel (Telegram, Messenger, SMS, email), with attempts. Already partly built, and it works.
- **Conversation and PSID mapping** for the customer bot, with message-id dedupe because Meta retries.
- **Admin identities** per channel. The second admin's Telegram id was lost and had to be dug out of old session transcripts.

### Analytics
- **Search events** (query, results, click, add to cart, paid), so search ranking can learn.
- **Revenue and conversion from the DB.** PostHog and the DB never agreed, so the owner asked agents to run SQL every week.

## 4. Workflows

- **Web checkout.**
  1. Cart, then phone, address and notes.
  2. `addOrder` creates the order and payment and creates the QPay invoice up front, so the QR appears at once.
  3. The customer taps a bank, the bank app opens, and the customer comes back.
  4. The webhook or a Khan match confirms the payment, stock moves, Telegram alerts the admins, and restock and cache jobs run.

  Facebook iOS often returns the customer to `/` and loses state. The fixes so far are a "continue unpaid" sheet, reusing the pending payment, an 8-second "no handoff" recovery sheet, and QPay as the default by user agent.
- **Transfer.** The customer sees the account and amount and presses "Шилжүүлсэн" or just waits. The poller matches the payment within a few minutes. If it doesn't, the payment lands in the admin inbox. The Messenger postback confirm path is retired.
- **Messenger order (bot).**
  1. Text or photo comes in. A photo goes to R2 (auto-deleted after 3 days), then to a vision model, then to catalog search.
  2. The bot sends a product card with a "Захиалах" button.
  3. A conversational cart builds up.
  4. The bot collects phone, address, zone and notes, then asks the customer to confirm.
  5. `addOrder` runs and the bot sends two buttons: QPay or transfer.

  The bot is still on a test Page because Meta business verification and app review block it.
- **Dispatch.** Every morning the admin selects the paid orders, picks a zone (suggested from address and past orders), sends them to TU singly or in batch, and prints labels. The owner wants a 10:00 Telegram brief listing all paid orders with a "ship all" button.
- **Stock intake.**
  1. Paste chat text or photos.
  2. Fuzzy-match each line to products with images.
  3. Review row by row and set the stock.
  4. Activate drafts and zero products missing from the catalog.
  5. Create unknown products through the AI import (Firecrawl Amazon scrape, Mongolian translation, R2 images).
  6. Purge caches and rebuild the search index, then restock notifications go out.

  Today this whole flow is an agent session, every time.
- **Restock notify.** A guest subscribes by email or phone. A cron sends in batches through the outbox. An SMS send that is ambiguous is never retried and goes to `unknown`.
- **Refunds.** Done by hand over Facebook. Nothing in the system records them.

## 5. Integrations and how they broke

| System | Use | What went wrong |
|---|---|---|
| QPay | invoice, QR, deeplinks, webhook | wrong creds and HTML responses early on. Invoice in KV lost to a floating promise. Double `payment_confirmed`. Deeplinks die in the FB iOS webview. 400k MNT token fee |
| Khan Bank (`khaan-client`) | transfer matching | owner's account locked by failed logins. OTP needed once per device. Endpoint moved to :9003 Apigee. Missed matches on 09-08. Reconciler result not shown in admin |
| TU / Misco courier | zones, dispatch | zone list outages broke checkout. Spurious "duplicated" rejections. API moved to v3. 500 from `shipOrder`. Double-encoded JSON |
| Meta Messenger | admin alerts, customer bot | 24h window blocks admin alerts. Duplicate replies from retries. Business verification and app review still open. Unsigned legacy webhook could change payments (P0) |
| Telegram (GramIO) | admin alerts, admin bot | works. Images were not reaching the model at first. Admin ids lost |
| Gemini / Workers AI Kimi K2.6 / OpenRouter | product import, vision, bot | Gemini credits ran out. Kimi has no structured output. Wrong Amazon images |
| Firecrawl | Amazon scraping | about 30 s per product, rate limits, wrong product matches, "Example Brand" placeholder rows |
| Search | Upstash, then MiniSearch in a DO | stale index after every catalog write, so "rebuild the index" is a standing chore |
| Cloudflare (Workers, KV, R2, DO, Hyperdrive) + Alchemy | everything | stale KV caches with no invalidation on write. Alchemy blocked Astro 7 and broke deploys. Hyperdrive local dev cost about a week. An ISP outage in June caused false "site down" panic |
| PlanetScale Postgres (Singapore) | DB | 300 to 4,800 ms round trips from Mongolia before caching. 15-minute outage on 08-29. No staging DB |
| PostHog / Axiom | analytics, logs | funnel disagrees with DB revenue. 429 limits. "[object Object]" logs until the logger rewrite |

## 6. What I actually spent agent time on

Tokens per category. Total is 4.78B tokens without Claude Code.

| Category | Sessions | Tokens | Share |
|---|---|---|---|
| review / QA / audits | 262 | 1,045M | 22% |
| inventory and catalog chores | 94 | 667M | 14% |
| UI design | 71 | 597M | 12% |
| bugfix | 94 | 501M | 10% |
| features | 72 | 438M | 9% |
| infra / deploy | 67 | 391M | 8% |
| payments code | 39 | 342M | 7% |
| tooling / agent setup | 146 | 249M | 5% |
| messenger / AI bot | 35 | 244M | 5% |
| analytics / reports | 30 | 132M | 3% |
| SEO / marketing | 34 | 97M | 2% |
| order ops (as operator) | 4 | 35M | 1% |
| delivery code | 16 | 33M | 1% |

The five biggest inventory sessions alone used 559M tokens:
- 2026-08-22, pi: matched a pasted shipment to products, set stock and prices, built the 340 kg import list. 142M.
- 2026-04-08, codex: photos to Gemini, dedupe, matched to the DB, activate and deactivate. 132M.
- 2026-02-09, opencode: reconciled the DB with a new inventory JSON. 117M.
- 2026-05-31, codex: price-list images to JSON, added 110 products, updated prices. 51M.
- 2026-08-04, pi: fixed the AI product import picking wrong Amazon images. 42M.

### Jobs I keep handing to agents, and what removes each one

| Job | Example ask | What removes it |
|---|---|---|
| Reconcile the catalog against a truth source (JSON, shelf photos, printed catalog, pasted stock) | "hi look at @stock.md i want you to model to match the name of this to the products in the db" | Variant fields plus a stock-intake screen with fuzzy match, images and per-row confirm |
| Dedupe products and brands | "if name and iu and dose and price match its a duplicate find more duplicates" | Unique constraint on the variant identity, plus a brand merge action |
| Add products by name or photo | "okay lets add the farmhaven one to db using the ai add product workflow" | Admin or Telegram import with a review queue that writes drafts |
| Bulk price and stock edits | "need this 4s price updated immediately first" | Inline edit that saves reliably, a bulk editor, and price history |
| Fix images | "why do some products have only like one image there should be at least 2 3" | Image pipeline to R2 with status, plus an image picker |
| Rebuild search and purge caches after edits | "curl that so search is rebuilt" | Write path that invalidates by tag and reindexes in the same step |
| Raw SQL on prod for one-off fixes | "look at my env and see db url and write some shit to make it do it" | Admin actions for merge, move, activate and deactivate, with an audit log |
| Is this order paid, where is it | "the money came into my account but it isnt confirmed" | Payment timeline per order, search by phone over all statuses, unmatched-transactions inbox |
| Why no orders today | "use my posthog mcp to see last 30 hours daya i havent got new orders since yesterday" | Alerts on paid-but-unlinked payments and on zero checkouts. DB-backed funnel page |
| Revenue and conversion numbers | "see todays sales data and revenue conversion rate" | Analytics page from the DB |
| Find duplicate unpaid orders | "find the repeated orders ... same products same address same phone number all not paid" | Checkout identity that reuses the open payment |
| Daily shipping | "at everyday at 10 am it shows all paid orders and ask the admin to ship all orders" | Scheduled Telegram brief with "ship all", zone suggestion and batch labels |
| Plan a shipment | "make me a list of products ... total weight should equal to 340kg with as few products as possible" | Weight and landed cost on variants, plus sales velocity |

## 7. Pain points that came from the design

- **The catalog was rebuilt four or more times** (Feb: 1.6k rows down to 422. Apr: from shelf photos. May: from price lists. Aug and Sep: from shipment text and catalog photos). Each rebuild started over because products have no stable identity.
- **Two ways to be deleted** (`status` and `deleted_at`), and two ways to be paid (KV invoice and DB payment).
- **No history** for price, stock, order status or payment. Every dispute became an investigation through logs.
- **Caches with no invalidation on write.** Old prices showed on prerendered product pages, old images showed in admin ("ctrl shift r doesnt help"), and out-of-stock items stayed on the home page until a redeploy.
- **Checkout rebuilt five or more times in May.** Session replay showed the real cause was in-app webview incompatibility, not the visuals.
- **Money-path bugs found by review, not by design.** Examples: the replay guard, the Postgres aborted-transaction trap (25P02), re-pricing from the live catalog, and the provider flip.
- **Incidents found by customers calling, not by alerts.**
- **Admin "fucking buggy mess unusable written by sonnet 3.5 era".** Saves did not persist, the list scrolled to the top after a refetch, and sessions expired too fast.
- **No staging DB.** Every agent fix touched prod, and the QA fixtures and one real test order needed a cleanup ledger.

## 8. Decisions and reversals worth carrying over

- **Zones.** The customer picked a zone at checkout until 2026-08-05. Since then the admin picks it at dispatch.
- **Messenger.** First the admin alert channel. Then "messenger wont be used anymore going forward just khaan client" (July). Then the customer bot became the plan again. Admin alerts moved to Telegram because of the 24h window.
- **Transfer confirmation.** Manual, then a customer claim plus admin confirm, then automatic Khan matching (June 20). Claims are now deprecated.
- **Search.** Upstash, then MiniSearch in a SQLite DO. Ranked by stock by default.
- **Bot model.** Gemini, then Kimi K2.6 on Workers AI. One model and one agent.
- **Stock intake.** Increment was proposed, then reversed to a set.
- **SEO.** A full SEO and AEO push in May and August, then a full `noindex` on 2026-09-09.
- **Admin.** React dashboard, then a planned Solid rewrite (home, products, orders, analytics only, cards not tables), then "do it all from Telegram with skills".
- **Storefront look.** It went brutalist, then soft, then sharp, then soft again. It ended at soft pastel with yellow pop, using the Unbounded and Onest fonts.
- **Engineering taste.** "dont write any fucking test ever". Proof comes from real endpoints and the browser. Small commits, no backward compatibility, libraries over custom code.

## 9. Where the owner wants it to go

- The website becomes the main channel. Fewer orders come through Messenger chat, and conversion is fixed for high-intent customers who fail at payment.
- One agent interface for all admin work (stock, price, add a product, add an order from a Messenger screenshot, find orders, analytics), most likely on Telegram, with a small mobile admin for what needs a screen.
- A customer Messenger bot that acts like the human admin and hands off to a human. It starts on the small page.
- Fully automatic payment confirmation with nothing left to do by hand.
- Fast pages on Cloudflare edge for Mongolian mobile networks.
- A new-arrivals screen, notify-when-back-in-stock, and cart cross-sell.
- Maybe multi-store (a second brand page and domain, then other merchants). Keep the store id in mind, but only build for it when it is real.

## 10. Clanker's take for the rewrite

My opinions after reading all of this.

1. **Model the variant first.** Most of the 667M inventory tokens went to agents rebuilding product identity from strings. A product-line table with a variant table (potency, unit, count, form, flavor, grams, ASIN) under a unique key removes most of that work.
2. **Make stock a ledger.** Use lots with expiry and movements with a reason. Keep current stock as a derived or cached column. "Set to counted" becomes one adjustment movement, and the bot can then answer expiry questions.
3. **Make shipment a real entity.** Weight, landed cost and supplier price feed both the pricing formula and the 340 kg planner.
4. **One `payment_event` table.** QPay webhooks, Khan matches, claims and admin actions all go in it as rows. The payment status follows from these events, and the "is it paid" screen is just this table.
5. **The DB is the only source of truth for money.** No invoices in KV, and nothing financial written after the response is sent.
6. **Freeze prices and fees on the order line.** Also record the channel on every order.
7. **One status field per entity, with a status history table.** Drop `deleted_at` plus `status` as two separate fields.
8. **Invalidate on write.** Every catalog write emits one event that purges the cache tags and reindexes search.
9. **Build the admin around the daily jobs.** Stock intake, the order and payment timeline, dispatch with batch labels, and the morning brief. Agents can then call the same actions instead of raw SQL.
10. **Get a staging DB, or at least a local seeded one.** Every catalog chore above ran against prod with the prod credential, and QA fixtures leaked into real data.

## Open questions I could not resolve from the sessions

- Will the shop accept cash on delivery? One prod fix prompt mentioned cash, nothing else did.
- What do the negative numbers in the May stock import mean ("Stock: -4")?
- Should the delivery fee vary by zone or countryside, or stay flat?
- Multi-store: is the second domain real, or still an experiment?
