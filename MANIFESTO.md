# THE AMERIK VITAMIN MANIFESTO

> To every coding agent, clanker, subagent, sidekick, future model, future hire, and the 2 am version of me that opens this repo half dead after work:
>
> Read this before you write a single line.
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

I pulled these from prod Postgres, PostHog, and two years of supplier email. They are real.

```text
What the database knows:          50,879,100₮    233 orders
What the business actually does:  ~1,300,000,000 to 1,800,000,000₮ a year
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
- **11 lint PRs sitting open that were already merged.** 28 numbered plans and a `validate.py` that validates the plans.

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
approve what to buy    → one Telegram message every morning, tap approve or edit
tap "it arrived"       → when a shipment lands, fix any count that's off
the weird chats        → complaints and edge cases the bot hands off to her
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

Meta wouldn't publish my Flue bot. My coworker said Zernio. Zernio carries it now (ADR 0011, PRs #339 to #344).

- Answers in 4 to 7 seconds, in mom's short Cyrillic voice, even though 70% of customers write in Latin-script Mongolian.
- Live prices. Live stock. **Expiry dates** (113 conversations in the export asked about expiry, the customers are telling us something).
- Code handles every tap, every order, every payment. The model answers questions. **The model never places an order on its own.**
- Every order goes through `addOrder`. **Every chat sale lands in the database.** This single fact fixes more of the business than any UI ever will.
- Hard stuff gets handed to mom on Telegram.
- It pilots on the small NatureBell + Micro Ingredients page first. Two brands, small catalog, fewer ways to embarrass us.

### 4.2 Payments confirm themselves

QPay confirms through its callback. Bank transfers confirm through Khaan transaction matching against the payment reference. The customer gets a Messenger confirmation. Mom finds out from the morning brief, not from a screenshot.

### 4.3 Delivery dispatches itself

Paid orders become courier dispatches through the delivery API, batched. Customer gets "on the way." Mom prints labels and hands over boxes.

### 4.4 Telegram is mom's entire admin

She already lives in Telegram. So the ops surface **is** Telegram, with inline buttons:

```text
☀️ Morning brief
   Yesterday: 34 orders · 7,240,000₮
   Paid, not shipped: 12
   Unmatched transfers: 2   [review]
   Running out: D3+K2 (4 left, ~2 days)   [reorder]

🛒 Reorder list
   NatureBell D3+K2 240    stock 4    sells 2/day    buy 40   [✓] [edit]
   Micro Magnesium Glyc.   stock 6    sells 1.5/day  buy 30   [✓] [edit]
   [approve all → opens prefilled Amazon cart]

📦 Shipment from Amazon #111-4429... arrived?   [yes, counts ok] [fix counts]

🆘 Bot handoff: customer says pills arrived broken   [open chat]
```

Buttons, not chat. An LLM that writes code against the admin API is fun for me and terrifying for her. Keep the LLM for one-off questions.

### 4.5 Supply knows itself

Amazon order emails forward to `orders@amerikvitamin.mn`. Cloudflare Email Routing → an `email()` handler → postal-mime. Raw `.eml` to R2 so we can replay anything. Order ID, total, status changes, ETA. Line items from the email if Amazon still includes them, from the screenshot import if it doesn't. Check real September 2026 emails before writing a single parser.

Then the part that actually matters:

```text
landed cost per unit = item USD × FX
                     + order shipping and tax, shared by line value
                     + forwarder fee, shared by weight
```

Frozen on receipt. Unknown historical cost stays **unknown**, never zero. The day margins become real is the day we start making decisions instead of vibes.

### 4.6 Stock tells the truth

One function moves stock. Nothing else touches the number. On hand comes from receipts and sales. Incoming comes from open supplier orders. The storefront says `Ирж байна, ~5 хоногт` instead of just disappearing.

### 4.7 Reorder reminders: the cheat code

The product table already has `dailyIntake` and pill count. **We know exactly when a 60-day bottle runs out.**

Day 50: "Your D3 is almost done. One tap to reorder."

Repeat customers are the cheapest revenue that exists and no shop in Mongolia does this. Meta's 24-hour rule limits Messenger outside the window, so this goes through approved message types, opt-in, or the SMS gateway we already have.

### 4.8 The reels engine (see §6, it gets its own section because it's the growth engine)

### 4.9 Three storefronts, one worker

- **amerikvitamin.mn**: the multi-brand retailer. Search, categories, comparisons.
- **naturebell.mn** and **microingredients.mn**: official brand sites. Brand story, the full line, authenticity, the brand's own look. They own the canonical URLs for their products.
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
- **Official.** Authorized distributor badge, authenticity, expiry dates on every product. Gray-market sellers can't say that.
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

She hates AI-generated images and video, and she's right. Nobody trusts a supplement shop that can't afford a photo.

- **Real product photos.** From the catalog, from R2.
- **Real footage.** Hands holding the actual bottle. Boxes arriving. Mom packing 40 orders. A real person explaining which magnesium is for sleep.
- **Her design system as templates.** Her taste, plus mom's conversion elements: price, days of supply, "comment ҮНЭ".

### Formats

1. **Catalog reels, fully automated.** 7 to 15 seconds: hook, product with motion, dose, days of supply, price, "comment ҮНЭ". Rendered from the database so price and stock are never wrong. 2 to 3 a day per page.
2. **FAQ reels.** From real Messenger questions: expiry, dosage, kids, which magnesium. The 1,697-conversation export already has the themes ranked.
3. **Arrival reels, half automated.** Shipment lands → mom films 10 seconds of boxes on her phone → sends to the Telegram bot → pipeline cuts it, adds subtitles, prices, branding → queued. "New stock just arrived" is a monster format for a shop like this.
4. **Human reels.** Talking head, UGC style. Agents write the scripts and hooks and do the editing. Humans do the trust.

### The loop

```text
reel goes out with "comment ҮНЭ"
        ↓
Zernio comment-to-DM fires a product card
        ↓
bot takes over, places the order
        ↓
order tagged with the reel it came from
        ↓
weekly report: which reels sold
        ↓
make more of the winners, boost ONLY the winners
        ↓
the random $8 boost is dead
```

Zernio is the pipe for all of it: posts, scheduled reels, Instagram Trial Reels shown only to non-followers that graduate when they perform, comment-to-DM automations, analytics, best time to post. Instagram gets added because reels reach further there and Zernio covers both from one call.

Rendering is Remotion on a cron, on GitHub Actions or the dev-box. Not on Workers.

### Approval

Every morning my girlfriend gets the day's rendered reels on Telegram. Approve or reject, one tap. **Nothing she hasn't seen gets published. Ever.**

She owns voice, hooks, the content calendar, template look, and where the money goes. Agents make volume underneath her taste.

### Things that will get us banned or sued

- **Health claims.** No "cures," no "treats," no "No.1." Meta rejects it and the brands we're becoming official for will hate it.
- **Instagram since late August 2026:** buttons and cards to non-followers in private replies get refused, and the failed call burns the one reply you get. Plain text first, buttons after they answer.

---

## 7. We're going official

The site got pulled from Google and the Facebook page went quiet on purpose, while we sort out becoming the authorized distributor for NatureBell and Micro Ingredients in Mongolia.

When that clears, marketing goes hard, and two official brand sites go live with it.

- Brand sites own the canonical URLs for their products.
- Authorized distributor statement, registration or permit numbers, approved wording only.
- Brand guidelines win over our taste on brand sites.
- At relaunch: cancel the Search Console removals, add the brand domains as properties, submit a database-driven sitemap per host, and 301 **every** old URL. Old backlinks are the cheapest SEO on earth.

---

## 8. The stack, and the rule above the stack

```text
vite-plus monorepo, pnpm catalogs
Solid 2, start mode
  + server components ("lakes"): markup ships once, client components in slots
Effect 4 RPC: one RpcGroup contract, tagged errors
PlanetScale Postgres via Hyperdrive, drizzle-orm 1.0 effect-postgres
better-auth
Alchemy 2: prod, staging, and a stage per PR with its own database branch
Cloudflare Workers Cache: Cache-Tag + purge, the ONLY cache layer
Remotion for reels, Zernio for everything social
```

Beta and RC are fine. I said so. Pin exact versions and upgrade on purpose.

Server components get one gate before the storefront depends on them, on a real preview deploy:

```text
correct status codes · single-hop 301s · canonical, meta, JSON-LD in the rendered HTML · sitemap per host
```

My own DUND demo already ran them on a Worker: Lighthouse mobile 90 to 93, CLS 0.06, 5 to 15 KB navigations. Its weak spot was blocking time (180 to 269ms). Watch it.

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
10. **No health claims. Ever.**
11. **Mom never needs a laptop.** If a flow only works on desktop, it doesn't work.
12. **Stable URLs forever.** Slug changes 301. Old URLs never 404.
13. **No feature without a person.** Name who uses it and what they stop doing.
14. **Briefs are exact.** SWE-2 does the hands-on work and it's free. Opus plans and reviews and it's not. Write briefs a cheaper model can't misread.
15. **Docs hold decisions. Commits hold history.** Delete finished plans. No `validate.py` for the plans. I'm looking at you, past me.

---

## 10. Order of battle

```text
1. stop the bleeding in vit-store      hotfix the name and stock bugs, start logging purchases,
                                       reconcile 57 pending orders and 65 pending transfers
2. Messenger bot live on pilot page    comment-to-DM → bot → addOrder → handoff on Telegram
3. payments + dispatch + Telegram      after this, mom only packs
4. morning brief + reorder approval    stock kept honest by receipts
5. reels engine                        catalog reels, arrival reels, girlfriend's approval flow
6. reels → orders reporting            boost only winners
7. schema v2 + data copy               as a financial reconciliation: counts, totals, stock all match
8. v2 slice                            product edit → server-component product page → verified checkout
9. three storefronts                   amerikvitamin.mn + the two official brand sites
10. relaunch                           GSC removals cancelled, sitemaps, 301 map, marketing goes hard
11. reorder reminders + restock alerts
12. Amazon email ingest                with landed cost, so margins finally exist
```

The month of downtime is for 1 through 4 plus the v2 foundation. Mom should be off manual duty **before** the marketing turns on, not after it melts her phone.

---

## 11. What we refuse to build

```text
a SaaS                                a multi-tenant platform
a Shopify clone                       a "headless commerce engine"
AI-generated product photos           AI-generated "lifestyle" videos
a desktop admin mom has to sit at     a dashboard nobody opens
a loyalty points program              a mobile app in the App Store
a recommendation engine               a CRM
a second cache layer                  a plugin system
anything with "AI-powered" in the copy
```

Store-kit sells shops to other people. This repo sells vitamins. Don't confuse them.

---

## 12. Why I care

I got a job in June. 2M₮ a month for the trial, 3.2M₮ after. It's not enough to live the way I want, and it's nothing next to what my mom's phone moves.

I borrowed money from my parents for AI plans so I could write more code than one person should. I want to pay them back. I want a mini PC with 32 GB of RAM so my agents stop fighting over memory. I want a homelab. I want a desk that doesn't hurt.

But mostly I want this:

> Mom wakes up. One Telegram message tells her what happened overnight. She taps approve on the reorder list. She packs the boxes. She hands them to the courier.
>
> Then she has the rest of the day.
>
> And the business is twice as big as last year.

That's the job.

**Every commit should make tomorrow's order need less of mom's phone than today's.**

Now go build it.
