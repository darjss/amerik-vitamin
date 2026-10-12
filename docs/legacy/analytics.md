# Analytics: what customers actually did

PostHog project `vit-store`, Dec 2025 to 2026-10-08. All numbers are one-off HogQL queries, not saved metrics. The interactive version is [analytics.html](analytics.html).

## The story in the traffic

- **Launch.** Ads started 2026-05-08. Visitors peaked at 372 on May 10. May had 2,885 visitors, more than every other month combined until August.
- **Outage.** Traffic was near zero from May 28 to Jun 14, 17 days in total. June had 418 visitors.
- **The long grind.** From July on, the site got 25 to 70 visitors a day, and ordering slowly climbed. The best order days were Aug 29 and Sep 4, with 13 each.
- **Noindex.** Visitors averaged about 65 a day in early September. After the full noindex on 2026-09-09 they fell to about 20 a day and stayed there.

## Orders seen by the browser

Server-side `order_created` events with `$revenue`, tracked from 2026-06-30. These are orders created, not orders paid.

| Month | Orders | Order value | Average order |
| ----- | ------ | ----------- | ------------- |
| Jul   | 76     | 16.6M₮      | 218k₮         |
| Aug   | 143    | 36.0M₮      | 252k₮         |
| Sep   | 93     | 20.0M₮      | 216k₮         |

In total that's about 73M₮ across 316 orders, with 1.6 to 1.9 items per order.

## Facebook is the storefront

- **Where visitors came from.** 41% of visitors since launch came through Facebook's in-app browser, and 87% were on a phone.
- **Facebook visitors buy more readily.** In-app visitors added to cart at 19.2%, against 13.1% in normal browsers. They reached checkout at 10.9%, against 8.1%. The intent is there. The payment hand-off is where they're lost.
- **Bank hand-off failures.**
  - 42% of Khan bank deeplink taps never opened the bank app (32 of 77).
  - qPay wallet failed 5 out of 5.
  - TDB failed 6 of 11.

  This is the root of the repeated-orders bug.

## Search and products

- **Top searches** are inositol (106), magnesium, berberine, omega, zinc, "Витамин d", collagen and "Магни ба Эрдэс". Customers search in both Mongolian and English.
- **Search fires on every keystroke**, so "ma", "mag", "magn" and "magne" are one person typing magnesium. Ranking search should work on whole queries, not keystrokes.
- **Most viewed products** are D3+K2 2,000 IU (190 people) and Magnesium Glycinate 1,000 mg (135), then D3+K2 5,000 IU, then Omega-3.
- **The variant problem is visible to customers.** One product, Micro Ingredients D3 5,000 IU + K2 100 mcg in 300 softgels, exists as three catalog rows with three names, priced at 110,000₮, 135,000₮ and 110,000₮.

## Errors customers hit

- **`Too many OTP attempts`**: 2,728 events from 4 people. The OTP form kept re-submitting itself after each failure.
- **View-transition errors**: about 2,400 events across roughly 600 people. They come from `Multiple elements found with view-transition-name: product-image-…`, where the same product image is rendered twice on a page, plus aborted transitions.
- **`Not a QPay payment`**: 69 client-side events from 7 people. That's only the share the browser saw of the provider-flip bug.
- **Total exceptions**: August had 2,934, the worst month.

## What the session replays showed

Replay Vision, PostHog's AI session watcher, summarized 21 recorded sessions between 2026-08-28 and 09-03. 11 were clean, mostly OTP logins and guest checkouts. 10 had friction, and nearly all of it sits between the cart, the order and the payment hand-off.

| Friction theme                                                                           | Sessions |
| ---------------------------------------------------------------------------------------- | -------- |
| Cart edited after the order was created: new order ids, stale totals on the payment link | 3        |
| Abandoned at the payment step                                                            | 3        |
| 404 on a payment link or page                                                            | 3        |
| Bank app hand-off failed, customer started a new checkout instead of resuming            | 2        |
| Guest's own order missing from the profile ("Захиалга олдсонгүй")                        | 2        |
| Cart emptied, or kept, after ordering                                                    | 2        |
| Tab-hopping and QR or copy friction on the payment page                                  | 1        |
| Product image rendered as a solid block                                                  | 1        |
| Login prompt in the middle of browsing                                                   | 1        |

What the sessions showed:

- **The 1,121,000₮ customer** had 10 items in the cart and tapped Khan bank. The app hand-off happened outside the browser, and the customer came back and started a new checkout instead of resuming. This is the repeated-orders bug, caught on a recording.
- **Order 0NDQ934J** was created, then the customer removed an item in the cart. The cart updated, but the payment link still showed the old items and total. The customer tried QPay, then Sono, then left.
- **KXUUW16H, then O8VYH6SV.** The customer ordered 2 items and kept shopping in a new tab. They hit a 404 on a payment link, added 2 items, and checked out again, leaving two orders.
- **Order GC855DYO31.** The customer came back from the Sono app with the cart still full. The profile said "no orders found", and they bounced between the payment link and the profile.
- **Kids Omega-3.** The product image rendered as a solid yellow block. The customer opened a new tab to see it, then bought it anyway.
- **Customers buy first and sign in later, if ever.** Guest checkout is the main path.

### UX rules for the rewrite

1. **One open checkout per customer.** While an order is unpaid, the cart edits that order, and the payment link always shows the live total. No silent new order ids.
2. **Returning from a bank app lands on the pending payment**, showing live status and "did it go through?". It never lands on the home page or starts a new checkout.
3. **The payment link is the order page.** Guests find their order by phone without logging in. The profile never says "no orders" right after someone ordered.
4. **Old payment links never 404.** A paid, expired or cancelled order shows its state.
5. **Show only payment methods that work.** No Sono until the store is approved. Put QR first in the Facebook in-app browser.
6. **Clear the cart only when payment is confirmed.**
7. **One image per product per page.** No duplicate view-transition names, and never a blank image block.
8. **Browsing never asks for a login.**

The Replay Vision tools need the `replay_scanner:read` scope on the PostHog key. These summaries were read from the `$recording_observed` events instead. Recordings are kept for 30 days.

## When people shop

In Ulaanbaatar time, visitors peak at 22:00 and orders peak at 12:00 and 16:00. People browse at night and pay the next day. For the rewrite, the 10:00 morning brief and the collage posts should go out before lunch.

## For the rewrite

- Count payments on the server and in the DB, never in the browser, because browser-side `payment_confirmed` undercounts badly.
- The bank hand-off from Facebook iOS is the money leak. Make QR-first and resume-pending-payment the default path, not the recovery path.
- Index real queries, not keystrokes, and keep transliterated aliases (магни, magni).
- One variant equals one product page equals one price.
