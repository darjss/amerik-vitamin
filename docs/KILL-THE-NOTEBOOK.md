# Kill the notebook

Mom writes every order and every stock item in a paper notebook. It's the real ledger of a business doing hundreds of millions of tugrik a year.

We're replacing it. Not by asking her to type the same lines into an app. That loses, every time, and she'll quietly go back to paper and our data rots.

We win by making the notebook **pointless**: most lines write themselves, and the few she still enters are faster than a pen.

## Respect the opponent

The notebook is genuinely great software. Study it before you try to beat it.

```text
opens instantly                 no login, no loading, no update, no battery
works with no signal            always
never rejects input             any format, any abbreviation, crossed-out corrections
one place for everything        orders, stock, notes, phone numbers, debts
flip back to any day            history is a thumb flick away
she trusts it completely        it has never lost an order
```

Every one of those is a requirement. Miss one and the notebook stays on the table.

## The five ways we win

### 1. Most lines write themselves

The biggest win isn't a better input field. It's no input at all.

- Bot orders from Messenger land in the DB on their own.
- Web and brand-site orders land on their own.
- QPay and Khaan-matched transfers mark themselves paid.
- Courier dispatch updates delivery status.
- Stock goes down on every sale and up on every receipt, automatically.

Once the bot is live, the share of orders she writes by hand should drop from 100% toward zero. **Track that number.** It's the real progress bar for this whole project.

### 2. The lines she still writes take under 10 seconds

For phone orders, walk-ins, and chats she handles herself, she types or dictates **one line, the way she already writes it**:

```text
Saraa 99112233 D3 2 magn glyc 1 Bayanzurkh 13 khoroo
```

The app turns it into a draft order:

```text
👤 Saraa · 9911 2233        (existing customer, 3 past orders)
🧴 NatureBell D3+K2 240 × 2      220,000₮
🧴 Micro Magnesium Glycinate × 1  115,000₮
🚚 Bayanzürkh, 13-р хороо          6,000₮
                          ───────────
                           341,000₮       [✓ save]  [edit]
```

- Deterministic matching first: phone numbers, known customers, product aliases she actually uses (`magn glyc`, `d3`, `hair`). An LLM only steps in when the rules can't decide, and it **only drafts**. She taps save.
- Product aliases are learned from her corrections. Fix `magn` → Magnesium Glycinate once, and it sticks.
- Phone voice typing works too. The phone's own keyboard dictation is the input, so we don't depend on Mongolian speech recognition quality.
- Target: **under 10 seconds per line, measured.** If writing it on paper is faster, we lost. Go back and fix it.

### 3. Stock by scanning, not writing

Supplement bottles have UPC barcodes. The phone camera reads them through the browser's barcode API, with a library fallback.

- **Receiving a shipment:** the expected lines are already there, from the supplier sheet or the parsed Amazon order. Scan, scan, scan, or tap confirm on lines that match. Each beep is +1 on that product. Done means the shipment is received and stock updates.
- **Counting:** count mode is scan, or big +/- steppers for things without barcodes. This is how the opening inventory count happens.
- **Packing check:** scan each bottle as it goes in the bag. A wrong product beeps red before it ships.
- Bonus: every product gets its `gtin` stored, which Google wants in Product structured data anyway.

### 4. It behaves like paper

- **Opens to Today in under a second.** No splash screen, no login wall. A long-lived session on her phone, plus a passkey when it does need one.
- **Works offline.** Writes queue on the phone and sync when signal comes back. A dead network never loses a line.
- **Never rejects input.** An unparseable line saves as a note on the day, flagged "needs a look." Nothing gets thrown away because a field is wrong.
- **Today looks like a notebook page.** A plain chronological list: who, what, how much, paid or not. Swipe left for yesterday, like flipping a page.
- **Corrections are visible.** Edits keep history, like a crossed-out line. She can see what changed.
- **Big type, Cyrillic, one thumb.** Cheap Android, bad light, standing up.

### 5. The collage comes out of the DB

The notebook is not her only ledger. For new arrivals her real system is the Facebook collage: product photos with prices, 70+ images per arrival, 9 to 12 products per image, repeats included. She has never entered an arrival in the dashboard, so the site's stock gets synced by hand from her posts. Asking her to use the dashboard instead loses, because the dashboard gives her nothing. The collage gets her orders.

So the DB makes the collage for her:

- **Generate her layout, not a nicer one.** Render it from in-stock variants: 9 to 12 products per image, a clear price on each, grouped by brand or category, in her crude style. Crude converts, see [CREATIVE.md](CREATIVE.md).
- **One tap out.** Download to her phone, or post through Zernio with a human tap. Nothing posts on its own.
- **Stock is right as a side effect.** Out-of-stock variants drop off the next collage. Prices come from the DB, so her post and the site always agree.
- **This needs the variant model.** Every variant needs a clean product photo and a short display name. "NatureBell D3+K2 240" goes on the image, not the Amazon title.

While she still posts her own collages, a scheduled job reads each new collage image with a vision model, matches it against variants by brand, potency and count, and sends a short diff to Telegram ("4 products in today's posts don't match the DB"). The owner taps fix or ignore. It replaces the multi-day agent sessions that did this sync by hand.

## The switch-over

She stops using the notebook when she trusts the app more than paper. Earn that, don't force it.

1. **Two weeks side by side.** She keeps writing the notebook. The app runs in parallel.
2. **Nightly check.** The app shows today's totals: orders, money in, stock that moved. She glances at the notebook. Any mismatch gets fixed in the app and becomes a bug for us.
3. **She picks the day.** When a week goes by with no mismatches, she decides when the notebook goes in the drawer. Not us.
4. **Old pages get digitized once** if it's worth it: the last few months of orders give us sales velocity for reorder suggestions from day one.

## How we know we won

```text
arrivals synced from her posts by hand    → 0
share of orders entered by hand            → toward 0%
median seconds per manual line             → under 10
mismatches in the nightly check            → 0 for 7 straight days
days since she last wrote in the notebook  → counting up
```

The day she forgets where she put the notebook, we shipped.
