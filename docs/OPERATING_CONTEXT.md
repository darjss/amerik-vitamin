# Operating context

MANIFESTO.md is why. This file is what's true right now. Read both before planning anything.

**Current milestone: [plan/01-launch.md](plan/01-launch.md).** The order of battle is MANIFESTO §10.

Facts here carry a status: **measured** (pulled from a system), **reported** (from email or the owner, not checked in code), **inferred** (an estimate), or **decided** (a standing call). Don't upgrade a fact's status in your head. If you act on an inferred number, say so.

---

## 1. Money

| Fact                                                                                                                 | Status                                                                                |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Prod DB, non-deleted orders in pending/shipped/delivered: 233 orders, 50,879,100₮, starting May 2026                 | measured                                                                              |
| Orders with a successful payment: 202, 44,811,100₮                                                                   | measured                                                                              |
| Every `sales.product_cost` is 0, because the purchase tables are empty                                               | measured                                                                              |
| Eagle Shine paid/final orders: about $219.9k                                                                         | reported                                                                              |
| Amazon, Sep 2025 to Sep 2026, gross order confirmations: 909 orders, about $141.3k, before cancellations and refunds | reported                                                                              |
| Visible procurement: at least about $361k, excluding iHerb, other suppliers and freight                              | reported                                                                              |
| Annual revenue 1.3B to 1.8B₮                                                                                         | **inferred** from procurement times retail markup. Not audited. Not a bank statement. |
| Pricing formula: `16,929 + 4,587 × USD`, rounded to 5,000₮, clamped 40k to 500k                                      | measured (vit-store `lib/ai-product/constants.ts`)                                    |

Most sales happen in Messenger chats typed by hand and never reach the DB. That's why the DB shows about 3% of the inferred business.

---

## 2. Regulatory: the real blocker

The storefront is quiet and the Facebook page isn't boosting because product registration in Mongolia is in progress. Code can't fix this. Don't let a technical plan pretend otherwise.

- **The Mongolian applicant is Arvijih Bell Wellness.** Use that entity everywhere: authorization letters, agreements, manufacturer forms, site footers, legal pages. The prior entity is not used for registration.
- **The batch is 34 NatureBell / Micro Ingredients products.** Eagle Shine received the full list. **Do not shrink or batch it preemptively.** Only if they ask.
- **What's missing is manufacturer-side paperwork:**
  - per-product final COA
  - analytical or testing method
  - GMO-free and narcotic/psychotropic-free declarations
  - English directions
  - packaging artwork
  - botanical Latin names and live-microbe species where they apply
  - a company profile and a quality and safety guarantee
  - the Form 9 manufacturer sections
  - an authorization letter letting Arvijih Bell Wellness register the products
- **The goal is a named Regulatory Affairs, QA or Compliance contact**, not endless back-and-forth with a sales inbox.

### Eagle Shine correspondence

```text
Apr 10   Eagle Shine: can certainly assist with the documentation, send the product list
Apr 15   confirmed receipt of the list
Apr 25   documentation "in process"
May 4    will follow up with the documentation team for an ETA
May 21   registering products in the Asian market, temporarily paused releasing some documents
May 28, Jun 22, Jul 21, Sep 9, Sep 24   our follow-ups, no useful response
Sep 29   Joseph S. (Senior Wholesale Manager) resurfaces: sends CGMP cert, Organic cert
         and NOP list, free-sale export certificate; offers a Non-GMO statement and
         asks for the product list
Sep 30   our full reply: new applicant entity, Form 9 attached, full 34-product list,
         the complete document list above, a request for an RA/QA contact, and
         intent to keep expanding Eagle Shine / NatureBell / Micro Ingredients in Mongolia
```

**State: waiting on Eagle Shine's reply to the Sep 30 email.** No agent sends email, follows up, or changes the SKU list. Escalation timing is the owner's call.

### Claims

- **Until authorization actually lands, we don't say "official distributor," "authorized," or anything that implies trademark rights.** That covers the brand sites, posts, reels and bot replies.
- The dedicated NatureBell and Micro Ingredients properties, the pilot page and later naturebell.mn and microingredients.mn, are planned. Their copy stays neutral until the paperwork allows more.
- No health claims ever: no "cures," "treats" or "No.1."

---

## 3. Messenger and Zernio

- **Zernio is how we get past Meta.** The Flue bot never got published through Meta. Zernio carries customer Messenger (vit-store ADR 0011).
- **Pilot:** the small NatureBell / Micro Ingredients page goes first.
- **Cost (reported, check current pricing before relying on it):** the first two connected accounts are free, roughly 10k outbound messages a month free, and negligible after that.
- **Agent access:** create a **profile-scoped read/write Zernio API key** limited to the pilot page for coding agents. Never hand an agent a key that can post to the main page.
- **The bot has never been live. Real customer data comes from the April to May 2026 Facebook export: 1,697 conversations, all answered by hand.** Every chat order today is a manual order.

### The bot: built in vit-store, ported here (decided)

vit-store PRs #339 to #346 are **merged** (Oct 1 2026) into vit-store main (measured). They built `apps/messenger`:

- Cloudflare `agents@0.24.0`, Chat SDK `chat@4.41.0`, `@zernio/chat-sdk-adapter`
- one Ingress Durable Object, and one Conversation Durable Object per thread holding inbox, cart, checkout, payments and outbox in its own SQLite
- an eval harness of 145 labeled cases from the Messenger export (#343)
- the Telegram admin bot as an `Admin` DO (#345), and durability fixes (#346). Flue is gone.

It talks to vit-store over tRPC + SuperJSON through 8 public procedures (product search, products by IDs ×2, `addOrder`, and four transfer/payment calls).

**Decided:** `apps/messenger` is ported into this repo and its store client calls the new Effect RPC contract directly. The bot never launched, so there's nothing to stay wire-compatible with.

### Human handoff is an explicit state machine (decided)

```text
BOT_ACTIVE → HUMAN_REQUIRED → HUMAN_ACTIVE → BOT_ACTIVE
```

- `HUMAN_REQUIRED`: Telegram pings mom or my girlfriend with buttons: take over, open the order in the dashboard.
- `HUMAN_ACTIVE`: the bot stays silent. The one thing it still sends is payment confirmations.
- Back to `BOT_ACTIVE` only through an explicit "return to bot" tap, in Telegram or the dashboard.
- The human replies where she already does, in the page inbox. The dashboard shows the handoff and the return button, and doesn't try to be a Messenger client.
- Orders a human takes during takeover get entered on the dashboard. Manual takeovers are the remaining leak once the bot is live.

**What #342 actually built (measured):** a 12-hour `paused_until` timer plus a resume URL. There's no state machine and no inline button, and it expires on a timer. The port replaces it with the states above.

---

## 4. Amazon email: the real format

Checked against the owner's inbox (reported). The samples below are synthetic, built in the same shape. **Never commit real names, addresses or order numbers.**

Confirmation:

```text
Subject: Ordered 30 items: Supplements

<Name>, your Supplements are confirmed!
Ordered · Shipped · Out for delivery · Delivered
Arriving Monday
30 Supplements
<recipient> - <CITY>, CA
Order # 111-0000000-0000001
Grand Total: $396.22
```

Shipment:

```text
Subject: Shipped 10 items: Supplements

<Name>, your Supplements were shipped!
Arriving today 10 AM – 3 PM
10 Supplements
<recipient> - <CITY>, CA
Order # 111-0000000-0000002
Total $130.90
Track package · Your invoice can be accessed here
```

**Reliable fields:** order ID, unit count, total, status, ETA or delivery window, destination city, plus the invoice and tracking links on shipment emails.

**Usually missing:** product names, per-SKU quantities, per-SKU prices.

**Sometimes present:** cancellation emails name the product, e.g. `Items cancelled successfully: 5 "NatureBell Multi Collagen..."`.

So the parser does order-level facts first. SKU lines come from another source:

- the existing screenshot import, attached to the auto-created supplier order
- later, the invoice or order-detail page. The order ID builds the invoice URL. Cloudflare's browser product now supports persistent sessions with human intervention, which is worth a prototype. Session persistence across fresh runs is unproven, so **Amazon scraping is never the critical path for v1**.

---

## 5. Inventory truth

Rebuilding stock history from scratch is impossible. Too much stock, too little history. So:

- **Pick an opening inventory date. Stock resets to a physical count on that date.**
- A-items, the fast sellers: count every unit exactly.
- B-items: full cartons plus loose units.
- The long tail: a sensible estimate is fine.
- From then on, inventory moves only through events: receipts in, sales out, adjustments with a reason. It converges on the truth over time.
- Costs before the opening date stay **unknown (null)**. Costs after it come from frozen landed cost on receipts.

---

## 6. How the business actually runs

- **The notebook is the real ledger today (reported).** Mom writes every order and every inventory item in a paper notebook. That's her system of record, not the DB, and nothing gets sent anywhere from it. Treat it as the current source of truth for what sold and what's in stock.
  - Consequences: it's the best source for sales history and velocity, and the reference point for the opening inventory count.
  - **Decided: the software replaces the notebook.** It has to be easier than paper, or she keeps the notebook and the data drifts. The plan, targets, and switch-over are in [KILL-THE-NOTEBOOK.md](KILL-THE-NOTEBOOK.md).
- **Her Facebook collages are the real catalog (reported).** When a shipment arrives she does not touch the dashboard. She takes product photos and posts them to Facebook as simple collages with prices: 70+ images per arrival, 9 to 12 products per image, with products repeated across images. The website's stock and prices are then synced by hand from those collages, through the owner and an agent session.
  - Cost (measured): one such sync, the pi session of 2026-08-22 to 08-27, used about 218M tokens including subagents. In 2026 catalog and stock chores took 667M tokens. See [legacy/agent-history.md](legacy/agent-history.md).
  - **Decided: the DB renders the collages.** She confirms arrivals in one screen and the collages come out of the DB, so posting them keeps stock right. See [KILL-THE-NOTEBOOK.md](KILL-THE-NOTEBOOK.md#5-the-collage-comes-out-of-the-db).
- **A physical store is likely coming (reported).** Showroom, pickup point and fulfillment hub on the same backend and the same stock. Orders already carry `source` and `fulfillment_type` for it (COMMERCE-RULES).
- **Her surfaces:** a mobile-first dashboard is home. Telegram handles notifications and quick actions: new order, today's packing brief, unmatched transfer, handoff, oversold, low stock.
- **She sells at normal volume during the downtime (reported),** by hand in Messenger, mostly **cash on delivery**. Manual orders keep COD. The bot and the sites are prepay (decided, see COMMERCE-RULES).
- **vit-store's admin is unusable for her (reported).** It holds 483 orders, 367 customers and 652 products (measured), and it sees about 3% of sales.
- **Delivery fee:** vit-store charges 6,000₮ in checkout and in the bot (measured). Her posts say 5,000₮ (reported). Confirm the real number before it ships anywhere.

## 7. Delivery

- **tu-delivery is the courier.** vit-store dispatches through its API and never reads status back (measured).
- **Their new API version has webhooks (reported).** The owner registers ours with them by hand. The webhook sets `delivered`.
- **Legacy orders that reached `shipped` were almost all received (reported).** They migrate as `delivered`. Legacy `pending` orders were never paid, and they migrate as `cancelled`.

## 8. Money in

- **QPay:** invoice plus callback, re-checked against QPay before it counts (measured, vit-store).
- **Khaan transfers come from a reverse-engineered internet-banking client,** [`khaan-client`](https://github.com/darjss/khaan-client), logged in with a username, a password and a remembered device ID (measured). vit-store polls every 25 s for 5 min after a customer claims they paid. It's fragile by nature. When it breaks, transfers fall to the human queue, and that's acceptable.
- **Customers prove transfers with screenshots today.** The export has about 570 of them in 6 weeks (measured).
