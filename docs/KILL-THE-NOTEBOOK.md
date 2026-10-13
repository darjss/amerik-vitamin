# Kill the notebook

Mom writes every order and every stock item in a paper notebook. It's the real ledger of a business doing hundreds of millions of tugrik a year.

We're replacing it. Asking her to type the same lines into an app loses every time. She quietly goes back to paper and our data rots.

We win by making the notebook **pointless**. Most lines write themselves, and the few she still writes are faster than a pen.

## Respect the opponent

The notebook is genuinely great software. Study it before you try to beat it.

```text
opens instantly                 no login, no loading, no update, no battery
works with no signal            always
never rejects input             any format, any abbreviation, crossed-out corrections
one place for everything        orders, stock, notes, phone numbers, who owes what
flip back to any day            history is a thumb flick away
she trusts it completely        it has never lost an order
```

Every row is a requirement. Miss one and the notebook stays on the table.

## The five ways we win

### 1. Most lines write themselves

The biggest win is no input at all.

- Bot orders from Messenger land in the DB on their own.
- Web and brand-site orders land on their own.
- QPay and Khaan-matched transfers mark themselves paid.
- The tu-delivery webhook marks parcels delivered.
- Stock moves on every sale and every receipt.

Once the bot is live, the share of orders she writes by hand drops from 100% toward zero. **Track that number.** It's the real progress bar for this project.

### 2. The lines she still writes take under 10 seconds

Phone orders, walk-ins, the chats she handles herself, and her COD orders get typed or dictated as **one line, the way she already writes it**.

**Nobody has seen a real notebook line yet.** The example below was made up. Before anyone writes the parser, photograph two or three real pages and build from those. The photos stay out of the repo.

```text
Saraa 99112233 D3 2 magn glyc 1 Bayanzurkh 13 khoroo
```

The app turns it into a draft:

```text
👤 Saraa · 9911 2233        (existing customer, 3 past orders)
🧴 NatureBell D3+K2 240 × 2      220,000₮
🧴 Micro Magnesium Glycinate × 1  115,000₮
🚚 Bayanzürkh, 13-р хороо         delivery fee
                          ───────────
                                  total       [✓ save]  [edit]
```

- **The parser is deterministic.** It matches phone numbers, known customers, and the product aliases she actually uses (`magn glyc`, `d3`, `hair`). When it can't decide, it shows a picker. She taps save.
- **Aliases learn from her corrections.** Fix `magn` → Magnesium Glycinate once, and it sticks.
- **COD is one tap on the draft.** Prepay is the default.
- **Voice works for free.** The phone keyboard's own dictation is the input, so we never depend on Mongolian speech recognition.
- **An LLM drafting step comes later, and only if measured misses justify it.** Even then it only drafts.
- **Target: under 10 seconds per line, measured** from first keystroke to save. If paper is faster, we lost. Go back and fix it.

### 3. Stock by scanning, not writing

Supplement bottles have UPC barcodes. The phone camera reads them through the browser's `BarcodeDetector`, with a library fallback.

- **Receiving a shipment:** the expected lines are already there, from the supplier sheet or the parsed Amazon order. Scan, scan, scan, or tap confirm on lines that match. Each beep is +1 on that product. Done means the shipment is received and stock updates.
- **Counting:** scan, or use big +/- steppers for things without barcodes. This is how the opening inventory count happens.
- **Unknown barcode:** she picks the product once and its `gtin` is stored. Google wants that in Product structured data anyway.
- **Packing check, later:** scan each bottle as it goes in the bag, and a wrong product beeps red before it ships.

### 4. It behaves like paper

- **Opens to Today in under a second.** Google sign-in once, then a long-lived session on her phone.
- **A typed line is never lost.** Each line saves to the phone first with an ID made on the phone, then syncs. The server treats a repeat of the same ID as the same line. Reading needs signal; writing never waits for it.
- **Never rejects input.** An unparseable line saves as a note on the day, flagged "needs a look."
- **Today looks like a notebook page.** A plain chronological list: who, what, how much, paid or owes. Swipe left for yesterday, like flipping a page.
- **Corrections are visible.** Edits keep history, like a crossed-out line.
- **Big type, Cyrillic, one thumb.** Cheap Android, bad light, standing up.

### 5. The collage comes out of the DB

The notebook is not her only ledger. For new arrivals her real system is the Facebook collage: product photos with prices, 70+ images per arrival, 9 to 12 products per image, repeats included. She has never entered an arrival in the dashboard, so the site's stock gets synced by hand from her posts. Asking her to use the dashboard instead loses, because the dashboard gives her nothing. The collage gets her orders.

So the DB makes the collage for her:

- **Generate her layout, not a nicer one.** Render it from in-stock products: 9 to 12 products per image, a clear price on each, grouped by brand or category, in her crude style. Crude converts, see [CREATIVE.md](CREATIVE.md).
- **One tap out.** Download to her phone, or post through Zernio with a human tap. Nothing posts on its own.
- **Stock is right as a side effect.** Out-of-stock products drop off the next collage. Prices come from the DB, so her post and the site always agree.
- **This needs structured products** ([ADR 0003](adr/0003-flat-products-no-variants.md)). Every product needs a clean product photo and a short display name. "NatureBell D3+K2 240" goes on the image, not the Amazon title.

While she still posts her own collages, a scheduled job reads each new collage image with a vision model, matches it against products by brand, potency and count, and sends a short diff to Telegram ("4 products in today's posts don't match the DB"). The owner taps fix or ignore. It replaces the multi-day agent sessions that did this sync by hand.

## The switch-over

She stops using the notebook when she trusts the app more than paper. Earn that.

1. **Two weeks side by side.** She keeps the notebook. The app runs in parallel.
2. **Nightly check.** The app shows the day's totals: orders, money in, who owes, stock that moved. She glances at the notebook. Any mismatch gets fixed in the app and becomes a bug for us.
3. **She picks the day.** When a week goes by with no mismatches, she decides when the notebook goes in the drawer.
4. **Old pages get digitized once, if it's worth it.** Those orders come in with source `notebook` and give reorder suggestions real sales velocity from day one.

## How we know we won

```text
arrivals synced from her posts by hand    → 0
share of orders entered by hand            → toward 0%
median seconds per manual line             → under 10
mismatches in the nightly check            → 0 for 7 straight days
days since she last wrote in the notebook  → counting up
```

The day she forgets where she put the notebook, we shipped.
