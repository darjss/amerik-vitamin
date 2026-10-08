# THE AMERIK VITAMIN MANIFESTO

> To every coding agent, clanker, subagent, sidekick, future model, future hire, and the 2 am version of me that opens this repo half dead after work:
>
> Read this before you write a single line. Then read [OPERATING_CONTEXT.md](OPERATING_CONTEXT.md), which is what's true right now. This file is why.
>
> This is not a PRD. PRDs are where intent goes to die in a table.
>
> This is the reason the repo exists. If you understand this file, you can make the right call on things nobody wrote down. If you skip it, you will build a beautiful system that solves nothing, and I will know, and I will delete it.

---

## 0. My mom runs a vitamin empire from her phone

Read that again.

My mom imports supplements from the US and sells them in Mongolia. NatureBell. Micro Ingredients. Nutricost. Doctor's Best. A shelf of 150+ SKUs that people here can't get anywhere else.

She does all of it from one phone.

Every reply on Messenger, she types herself. Every price, she quotes from memory. Every bank transfer, she checks against a screenshot a customer sent. Every delivery, she arranges. Every post, she makes by hand: a collage of product photos with prices drawn on them, a caption that says `Amerikaas irsen vitamin zarj bna. Utas 99993950. hurgelt 5000`, and an $8 boost.

That collage looks like it was made in 2014 and it **outsells every pretty thing we've ever designed.** Remember that. It's going to come back.

On a good day she does 20 to 30 orders in chat. By hand. Then she packs them. Then she does it again tomorrow.

I'm a new grad dev with a 2M₮ job, a terminal full of agents, and a mom whose evenings belong to Messenger.

This repo exists to give her the evenings back, and then to make the business so big that she has to hire someone to pack boxes.

---

## 1. The numbers that should make your weights twitch

I pulled these from prod Postgres, PostHog, and supplier email. The database numbers are measured. The yearly number is inferred from procurement times markup, not audited. [OPERATING_CONTEXT.md](OPERATING_CONTEXT.md) marks which is which, and you should too.

```text
What the database knows:          50,879,100₮    233 orders          (measured)
What the business probably does:  ~1,300,000,000 to 1,800,000,000₮ a year   (inferred)
```

**The system sees about 3% of the business.** The other 97% lives in my mom's Messenger inbox and her memory.

Supplier side, Sep 2025 to Sep 2026:

```text
Amazon:        909 orders   $141,344
Eagle Shine:                $219,900
Visible spend:              ~$361,000
```

And the database's opinion on cost of goods:

```text
SELECT DISTINCT product_cost FROM ecom_vit_sales;
 product_cost
--------------
            0
```

Zero. Every row. We have literally no idea what our margins are. The pricing formula says 32 to 46% gross before freight, mom says "50 to 70" (that's markup, mom), and the database says we sell everything at 100% profit, which is a lie the database tells because nobody ever entered a purchase.

More crime scene photos:

```text
orders that ever reached "delivered":         1
orders stuck in "pending" since July:        57
bank transfers still "pending":              65
abandoned checkouts:                        208   (45.3M₮ of carts, unaudited)
traffic from Meta:                           55%
traffic from Google:                         10%  (and climbing before we pulled it)
```

The order status flow isn't a flow. It's decoration.

---

## 2. Why vit-store had to die

`darjss/vit-store` was born in July 2025 and raised by Sonnet 3.5, GPT-4, and DeepSeek R1, plus whatever got pasted in from Stack Overflow at 3 am. It made real money. It handled real payments. Respect to it.

It is also a haunted house.

- **The schema is fossilized.** It's a 6-line diff from a Next.js + Turso dashboard I made in December 2024. **81 of the original 84 columns survived four framework rewrites.** We repainted the kitchen four times and never fixed the floor.
- **Saving a product corrupts its name.** The form loads `"NatureBell D3 5000IU 240"`, the server rebuilds it as `${brand} ${name} ${potency} ${amount}`, and you get `"NatureBell NatureBell D3 5000IU 240 5000IU 240"`. Every save. Then it regenerates the slug and forgets the old one, so every edit 404s a URL Google already indexed. Then I opened issue #78 to clean up the duplicates. I built myself a job.
- **You can't edit a product with 0 stock.** The edit form validates with the _add_ schema, which demands stock ≥ 1. And when a save does go through, it overwrites live stock with whatever stale number was sitting in the form.
- **Four cache layers, two of them never invalidated.** TanStack Query, a KV cache that keeps dashboards 50 minutes stale, Workers Cache, and an Upstash search index that rebuilds **the entire catalog** on every single write, so edits snap back like a rubber band.
- **Changing a phone number fails** because orders have a foreign key to `customers.phone`, an integer.
- **A brand new Postgres pool on every `db()` call.** Never closed.
- **The sitemap lists 71 noindex redirect stubs and 185 duplicate old-slug pages** and forgets the real category pages. The "301 redirects" are meta-refresh pages that return 200. The OG images are SVG, which Facebook won't render.
- **3,500 lines of purchase tracking. Used zero times.**
- **88,000 lines of code. 2 test files.**
- **11 lint PRs left open after they'd already merged.** 28 numbered plans and a `validate.py` that validates the plans.

So we burn it down and keep the lessons.

**Do not port legacy code.** Recover behavior on purpose. Read vit-store like an archaeologist reads a ruin: to learn what people needed, not to copy their plumbing. If you catch yourself copy-pasting a vit-store file into this repo, stop and ask what behavior you actually wanted.

---

## 3. The mission in one sentence

> **Mom packs the boxes and decides what to buy. Software does literally everything else.**

That's it. That's the whole company.

### What mom still touches

```text
pack the orders        → from a pick list, labels printed from her phone over Bluetooth
hand them to courier   → dispatch already created, she just hands over parcels
approve what to buy    → the reorder screen on her phone, tap approve or edit
tap "it arrived"       → when a shipment lands, fix any count that's off
the weird chats        → complaints and edge cases the bot hands off to her
her own orders         → one line each, faster than the pen, until the bot takes most of them
```

### What mom never touches again

```text
answering "үнэ хэд вэ?" for the 4,000th time
quoting prices from memory
checking bank screenshots against transfers
typing addresses into a delivery app
making collages
deciding when to boost
remembering who bought D3 two months ago
guessing what's about to run out
```

If a feature doesn't move something from the second list to "handled," or make the first list faster, **it doesn't ship.**

Later, when this works, I go full time or she hires a packer. Either way the software is ready.

---

## 4. The machine

Every one of these is a real system with a real job. None of them are "platforms."

### 4.1 The Messenger bot, through Zernio

Meta wouldn't publish my Flue bot. My coworker said Zernio. Zernio carries it now. The bot got built inside vit-store (PRs #339 to #346, merged), it never launched, and it moves into this repo with a new backend under it.

- Answers in 4 to 7 seconds, in mom's short Cyrillic voice, even though 70% of customers write in Latin-script Mongolian.
- Live prices. Live stock. **Expiry dates** (113 conversations in the export asked about expiry, the customers are telling us something).
- Code handles every tap, every order, every payment. The model answers questions. **The model never places an order on its own.**
- Bot orders go through the exact same order function as mom's dashboard. **Every chat sale lands in the database.** This single fact fixes more of the business than any UI ever will.
- Bot orders are prepay: QPay or transfer before anything gets packed.
- Hard stuff gets handed to a human: a Telegram ping, one tap to take over, and the bot shuts up. She answers in the page inbox like she always has. One more tap gives the chat back. No timers. The bot never wakes up mid-conversation on its own.
- It pilots on the small NatureBell + Micro Ingredients page first. Two brands, small catalog, fewer ways to embarrass us.

### 4.2 Payments confirm themselves

QPay confirms through its callback. Bank transfers confirm by Khaan matching on the payment number or the customer's phone, plus the exact amount. Anything ambiguous goes to a human, never a guess. The customer gets a Messenger confirmation. Mom finds out from the morning brief, not from a screenshot.

Her own manual orders stay cash on delivery, because that's how she sells and we're not here to change how she sells. The dashboard tracks who owes what, the way the notebook does now.

### 4.3 Delivery dispatches itself

Orders ready to go become tu-delivery dispatches, batched. The customer gets "on the way." The courier's webhook says delivered, so `delivered` finally means something. Mom prints labels and hands over boxes.

### 4.4 The dashboard lives in her pocket. Telegram taps her on the shoulder.

Two surfaces. Different jobs. Don't blur them.

**The dashboard is home.** A mobile-first web app built for one thumb on a cheap Android in bad light. It's where she actually works:

```text
TODAY
  📦 Pack 23 orders              [pick list] [print labels]
  💸 2 transfers need a look     [review]
  🆘 1 chat handed to you        [open]
  ⚠️ D3+K2: 4 left, ~2 days      [reorder]

ORDERS      search by phone, one tap to see everything about a customer
REORDER     NatureBell D3+K2 240   stock 4   sells 2/day   buy 40   [✓] [edit]
            [approve all → opens a prefilled Amazon cart]
ARRIVALS    Amazon #111-4429... landed?   [counts ok] [fix counts]
PRODUCTS    price and stock edits that actually save, the first time
```

The old admin was a desktop dashboard shrunk onto a phone. This one is a phone app that happens to be a website. If a screen needs pinch-zoom, it's broken.

**Telegram is the nervous system.** She already lives there. It pings and offers the one obvious tap, then deep-links into the dashboard for anything bigger:

```text
🛍 New order #A3F2 · 245,000₮ · paid by QPay · Bayanzürkh
☀️ Today's packing: 23 orders, 41 items                   [open pick list]
💸 Transfer 180,000₮ didn't match any order                [match] [open]
🆘 Customer says pills arrived broken                       [take over]
📉 Micro Magnesium: 3 left                                  [add to reorder]
```

Buttons, not chat. An LLM that writes code against the admin API is fun for me and terrifying for her. Keep the LLM for one-off questions.

### 4.5 Supply knows itself

Amazon order emails forward to `orders@amerikvitamin.mn`. Cloudflare Email Routing → an `email()` handler → postal-mime. Raw `.eml` to R2 so we can replay anything. The real emails are known now (OPERATING_CONTEXT.md §4): order ID, unit count, total, status, ETA, and invoice and tracking links. **No product names, no per-SKU prices.** So the parser does order-level facts, and SKU lines come from the screenshot import, later the invoice page. Amazon scraping never sits on the critical path.

Then the part that actually matters:

```text
landed cost per unit = (item USD + shipping shared by weight) × FX
                       shipping ≈ $10/kg, real number per shipment
```

Frozen on receipt. Unknown historical cost stays **unknown**, never zero. The day margins become real is the day we start making decisions instead of vibes.

### 4.6 Stock tells the truth

One function moves stock. Nothing else touches the number. On hand comes from receipts and sales. When the number goes negative, that's the number confessing it was wrong: mom gets a ping to count it, and the paid order still ships. Incoming comes from open supplier orders. The storefront says `Ирж байна, ~5 хоногт` instead of just disappearing.

### 4.7 Reorder reminders: the cheat code

The product table already has `dailyIntake` and pill count. **We know exactly when a 60-day bottle runs out.**

Day 50: "Your D3 is almost done. One tap to reorder."

Repeat customers are the cheapest revenue that exists and no shop in Mongolia does this. Meta's 24-hour rule limits Messenger outside the window, so this goes through approved message types, opt-in, or the SMS gateway we already have.

### 4.8 The reels engine (see §6, it gets its own section because it's the growth engine)

### 4.9 Three storefronts, one worker

- **amerikvitamin.mn**: the multi-brand retailer. Search, categories, comparisons.
- **naturebell.mn** and **microingredients.mn**: the brand sites. Brand story, the full line, authenticity, the brand's own look. They own the canonical URLs for their products.
- Same backend, same checkout, same orders. Each domain keeps its own cart.

---

## 5. The money: 500,000,000₮ a month

Here's the ladder. Average order is about 200k₮.

```text
                          orders/day     monthly
relaunch floor            15 to 20       90 to 120M₮       (get back what we had)
6 months after official   35 to 50       200 to 300M₮
12 months                 80 to 120      500M₮+            ← the target
```

500M₮ a month is about 2,500 orders, about 83 a day. At a 1.6x multiple, that's roughly **$90k of supplier spend every month**.

Here's what actually stands between us and that number. It's not the framework.

1. **Stock.** Most SKUs sit at 8 to 20 units. Niche ones at 5 or fewer. A few hit 100. At 83 orders a day the shallow SKUs die in a week. Reorder points from real sales velocity, or nothing else matters.
2. **Cash.** $90k a month of inventory has to be bought before it's sold. Margins have to be real numbers to plan that.
3. **Mom's hands.** Manual breaks somewhere past 30 orders a day. §3 and §4 are the only way past it.
4. **The market.** Mongolia is small. The ceiling is demand and competitors, not tooling. Official distributor status opens the second channel: wholesale to pharmacies and other shops.

### How we wipe out the competition

- **Never be out of stock on fast sellers.** And keep the niche SKUs stocked too, because competitors won't carry them. That's the moat.
- **Reply faster than any human shop.** The customer who messaged three shops at 2 am buys from whoever answers first. That's us. Always.
- **Reorder reminders.** Nobody else does this.
- **Registered products, then official.** Once registration and authorization land: the distributor statement, permit numbers, authenticity, expiry dates on every product. Gray-market sellers can't say that. Until the paperwork says so, we don't say so either.
- **Price per SKU, not per formula.** Undercut on hero products like D3+K2, magnesium, and omega-3. Keep full margin on the niche stuff nobody else has.
- **Out-post everyone.** When posts generate themselves, daily per brand costs nothing.

Numbers I want every Monday: conversations → orders (about 25% in the export), first reply time, average order value, stockouts, and **orders per reel**.

---

## 6. Creative doctrine: reels, real footage, and the collage lesson

### The collage lesson

My girlfriend is a marketing manager. She made beautiful things: a clean editorial Boron card, a D3&K2 video, a cold-season carousel. They flopped.

Mom's ugly collage beat them. Here's why, and this is law now:

```text
mom's collage                     the pretty stuff
───────────────────────────       ───────────────────────────
price visible, every product      no price
"Utas 99993950, hurgelt 5000"     no way to buy, or links to a website
                                  when customers buy in Messenger
answers the buying question       answers "what is boron" (nobody asked)
one name                          three names for one shop
```

**Every creative answers: what is it, how much, how do I get it. In one look.**

And **likes are a vanity metric.** Mom's collage had 1 like and drove chats. The only score is DMs and orders.

### No AI slop media

She hates AI-generated images and video, and she's right. Nobody trusts a supplement shop that can't afford a photo. Real product photos. Real footage: hands holding the actual bottle, boxes arriving, mom packing 40 orders. Her design system as templates, carrying mom's conversion elements: price, days of supply, "comment ҮНЭ".

### The loop

Reel goes out with "comment ҮНЭ", Zernio comment-to-DM fires a product card, the bot takes the order, the order is tagged with the reel, and the weekly report says which reels sold. Make more of the winners. Boost ONLY the winners. The random $8 boost is dead.

My girlfriend owns voice, hooks, the calendar, the look and where the money goes. Agents make volume underneath her taste, and nothing she hasn't seen gets published. Ever.

Formats, Zernio specifics, the approval flow and the banned list live in [CREATIVE.md](CREATIVE.md).

---

## 7. We're going official

The site got pulled from Google and the Facebook page went quiet on purpose, while 34 NatureBell and Micro Ingredients products go through Mongolian registration under **Arvijih Bell Wellness**. The blocker is manufacturer paperwork from Eagle Shine: COAs, test methods, declarations, artwork, an authorization letter. The live state of that is in OPERATING_CONTEXT.md §2. Agents don't email suppliers.

When that clears, marketing goes hard, and two dedicated brand sites go live with it.

- Brand sites own the canonical URLs for their products.
- **No "official" or "authorized" wording until the authorization actually permits it.** Then permit numbers and approved wording only.
- Brand guidelines win over our taste on brand sites.
- At relaunch, 301 **every** old URL. Old backlinks are the cheapest SEO on earth. The day-of list is [RELAUNCH.md](RELAUNCH.md).

---

## 8. The stack, and the rule above the stack

```text
vite-plus monorepo, pnpm catalogs
Solid 2 start mode, server components only after they pass the gate
Effect 4 RPC: one RpcGroup contract, tagged errors
one PlanetScale Postgres via Hyperdrive, drizzle-orm 1.0 effect-postgres
better-auth, Google sign-in
Alchemy 2 if it proves itself, wrangler if it doesn't
Cloudflare Workers Cache: Cache-Tag + purge, the ONLY cache layer
Remotion for reels, Zernio for everything social
```

Beta and RC are fine. I said so. Pin exact versions and upgrade on purpose. The why, the gates and the gotchas are in [STACK.md](STACK.md).

**And the rule above the stack:**

> This repo does not exist to prove Solid 2, Effect, or Alchemy are good.
>
> It exists so my mom stops typing prices into Messenger at 11 pm.
>
> If you're three days deep in the most elegant reactive abstraction ever conceived and mom is still checking bank screenshots, you have lost the plot. The plot is a box of vitamins.

---

## 9. The laws

Break these and the PR gets closed without a review.

1. **Every sale lands in the database.** Chat, web, brand site, phone call, carrier pigeon. If it's not in Postgres it didn't happen.
2. **Money is an integer with a currency.** Never a float. Never a guess.
3. **Unknown is null, not zero.** A zero cost turned our margin report into fiction once. Never again.
4. **Stock moves through one function.** Nothing else writes that number.
5. **No fake success.** A failed payment lookup does not become `pending`. A failed courier call does not become `dispatched`. Say what happened.
6. **Checkout rechecks Postgres.** Prices and stock from cache are for browsing, never for charging.
7. **One cache.** Workers Cache with tags. If you want a second cache, you want a bug.
8. **The model never places an order or moves money on its own.** Code does. The model talks.
9. **Nothing publishes without a human tap.** Reels, posts, boosts.
10. **No health claims. Ever. No "official" until the paperwork says so.**
11. **Mom never needs a laptop.** If a flow only works on desktop, it doesn't work.
12. **Stable URLs forever.** Slug changes 301. Old URLs never 404.
13. **No feature without a person.** Name who uses it and what they stop doing.
14. **Opus builds.** Opus 5.5 plans, writes and reviews the code. Another model gets work only when I say so, and then with a brief so exact that done and not-done can't be confused.
15. **Docs hold decisions. Commits hold history.** Delete finished plans. No `validate.py` for the plans. I'm looking at you, past me.

---

## 10. Order of battle

Mom is selling right now, by hand, cash on delivery, into a paper notebook. So the downtime goes to the things that take work off her phone today. The storefront can wait. Nobody's looking at it anyway.

```text
PHASE A: the bot first, then the dashboard                  ← we are here
0. foundation           one DB over Hyperdrive, Workers on Alchemy, /health round-trips
1. schema v2            COMMERCE-RULES as code in Effect. one test file proves every rule
2. product import       652 vit-store products into shop, old slugs kept. mom spot-checks 20
3. payments             QPay, Khaan matching, the unmatched-transfer queue. the bot is prepay
4. the bot              ported from vit-store, all Effect, handoff state machine, Telegram pings.
                        live on the pilot page
5. dashboard v1         Today page, one-line entry, COD, pack list. side by side with the notebook.
                        customers and old orders come over here
6. delivery             tu-delivery dispatch, webhook sets delivered
7. telegram             new order, packing brief, unmatched transfer, oversold
8. cutover              vit-store checkout off. one system

PHASE B: stock that tells the truth
9.  opening count       barcode scan, gtin learned on first beep, A-items exact
10. receipts            supplier orders, scan-to-receive, landed cost frozen
11. Amazon email        order-level facts in, "needs lines" queue, screenshot import for SKUs
12. reorder screen      sales velocity → buy list → approve

LATER
reels engine and reels → orders reporting
three storefronts behind the server-components gate
relaunch (RELAUNCH.md)
reorder reminders and restock alerts
```

Mom should be off manual duty **before** the marketing turns on, not after it melts her phone.

---

## 11. What we refuse to build

```text
a SaaS                                a multi-tenant platform
a Shopify clone                       a "headless commerce engine"
AI-generated product photos           AI-generated "lifestyle" videos
a desktop admin mom has to sit at     a dashboard nobody opens
a loyalty points program              a mobile app in the App Store
a recommendation engine               a CRM
a Messenger client in the dashboard
a second cache layer                  a plugin system
anything with "AI-powered" in the copy
```

Store-kit sells shops to other people. This repo sells vitamins. Don't confuse them.

---

## 12. Why I care

I got a job in June. 2M₮ a month for the trial, 3.2M₮ after. It's not enough to live the way I want, and it's nothing next to what my mom's phone moves.

I borrowed money from my parents for AI plans so I could write more code than one person should. I want to pay them back. I want a mini PC with 32 GB of RAM so my agents stop fighting over memory. I want a homelab. I want a desk that doesn't hurt.

But mostly I want this:

> Mom wakes up. One Telegram message says today is 23 orders. She opens the dashboard, taps approve on the reorder list, prints the labels. She packs the boxes. She hands them to the courier.
>
> Then she has the rest of the day.
>
> And the business is twice as big as last year.

That's the job.

**Every commit should make tomorrow's order need less of mom's phone than today's.**

Now go build it.
