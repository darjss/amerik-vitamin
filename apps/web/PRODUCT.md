# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Mom, the owner of Amerik huns baraa, alone on her own iPhone (a Pro model, about a 14). She takes orders, packs parcels, hands them to the courier and decides what to restock. The owner's son checks in from time to time but is not the user the screens are built for.

## Product Purpose

The dashboard replaces her paper notebook and vit-store's unusable admin. Success is that she packs and ships the day's orders, collects what's owed and restocks on time without writing anything down. Software does everything except packing boxes and deciding what to buy.

## Operating Context

- The first job of the day is packing: in the morning at the table, she pulls bottles off the shelf, packs each order and hands the parcels to the courier. Money and stock come second.
- Many products look alike by name: several omega-3s and D3s that differ by brand, strength and count. The product photo is how she tells them apart at a glance.
- Orders arrive from the Messenger bot, the storefront and her own chats. Payment is QPay, bank transfer (Khaan) or cash on delivery.
- Delivery goes through TU, which reports delivered by webhook.
- All UI text is Mongolian Cyrillic. Money is in tugrik (₮), written like 155,000₮.

## Capabilities and Constraints

- Order statuses: new, paid, shipped, delivered, cancelled. Terms are in `GLOSSARY.md`. Order rules are in `docs/COMMERCE-RULES.md`.
- Product photos exist for most products on `cdn.amerikvitamin.mn`.
- Stack: Solid 2 on Cloudflare Workers, Panda CSS, the terracotta headless library, Phosphor icons and solid-toast (`docs/STACK.md`).
- Google sign-in with an email allowlist and no roles.

## Brand Commitments

None for the dashboard. It's internal, and vit-store's look does not carry over.

## Look

The owner picked this on 2026-10-19 after two rounds of phone prototypes. Her most-used apps set the feel: Facebook, Messenger, Instagram, Meta Business Suite and Amazon. The dashboard borrows their habits: photo-first rows, filter chips, a to-do list with a button on each row and a step tracker on the order. It copies none of their screens, so there are no stories, no chat bubbles, and no borrowed headers or brand colors.

The look is "Native, two-tone", chosen 2026-10-20 from three directions drawn from scratch (Atelier, Native, Market). Earlier rounds were rejected: espresso and clay (brown everywhere), cold iOS gray, marigold and lilac highlights, cream and navy on flat hairline strips ("dead, bare"), and stacked rounded order cards. The prototype is in the scratchpad at `prototypes/v6/native/`.

It should feel like Apple built it for her phone, but warm. Everything she handles, such as bottles, the packing list, the receipt and buttons, stands up off the cream with soft depth. Everything she only reads is plain type on the cream with no box around it. Bars that float over the page are frosted glass. Every tap squeezes slightly and springs back.

Two tones do the work. Warm ink fills every action. Petrol teal marks what's selected or done. The other colors are statuses only, so teal never means paid and ink never means a status.

| Token     | Value                  | Use                                                                                 |
| --------- | ---------------------- | ----------------------------------------------------------------------------------- |
| page      | `#f8f4ec`              | Background                                                                          |
| surface   | `#fffdf9`              | Raised panels, buttons, chips, search fields                                        |
| ink       | `#1e1b17`              | Text, and every filled action: TU-д өгөх, Савлах, +, call, Захиалга үүсгэх          |
| ink-muted | `#665e54`              | Secondary text                                                                      |
| chip      | `#efeae0`              | Segmented control track, an action that isn't ready yet                             |
| sel       | `#0f4c5c`              | Active filter, done tracker steps, ticks, packing progress, ×N badges, picked tiles |
| sel-soft  | `#e1ecee`              | Active tab, ×N on the order page, "2 дахь захиалга", a held row                     |
| paid      | `#2f6b3a` on `#e5efe2` | Paid                                                                                |
| owes      | `#b4233c` on `#fbe6e8` | Money to collect, payment waiting, sold out                                         |
| wait      | `#8a5a00` on `#f8ecce` | Notes she must not miss, "3 хоног", low stock                                       |

Type is Inter with optical sizes, so large titles draw as Inter Display. It has Mongolian's Ө and Ү. Numbers use tabular figures. Icons are Phosphor only.

Rules:

- An action looks like an action. The next step on every order is a filled ink button, and an outlined step reads as a label.
- Product photos are raised white tiles with ×N as a teal badge on the corner. A tap shows the photo full size, except in the packing checklist and the new-order grid, where a tap does the row's job.
- Orders are separated by space, not lines or cards. Panels are for things she handles: today's packing, the checklist, the receipt, the grouped form fields.
- Pages open with an iOS large title. Sections get a bold title over plain content, never a gray uppercase label.
- The tab bar is one floating glass capsule. A screen's main action is docked at the bottom over frosted material.
- A choice between two or three options is a segmented control with a sliding white thumb.
- No loud banner at the top. Today's packing on Orders is one quiet row with three bottle thumbnails and Савлах.

Screens:

- **Нүүр** opens with the date as a large title. Today's packing comes first: one raised panel with every bottle to pull off the shelf and its ×N, and a full-width Савлах. Then Хийх (a payment to verify, with Шалгах), Мөнгө (COD left to collect in red, money in today), and Дуусаж байна (low stock with what's left).
- **Захиалга** has a large title, a round + for a new order, search (order number, or 3 to 8 digits of a phone), and filter chips with counts. On Илгээх, a packing row opens Савлах. Each order shows:
  - the phone, with "3 хоног" once a ready order has waited two days, and the money pill on the right
  - the address on one line
  - the note in a note box
  - one photo per product with ×N
  - the next-step button

  Tapping the step holds it for 5 seconds as "Болих N" before writing. Customers are known by phone, so no screen shows a name.

- **Order** has:
  - a frosted bar with × and ⋯
  - the status as a large title, with payment, time and source under it
  - a four-step tracker with dots
  - Бараа
  - Захиалагч: the phone with "Нийт N захиалга" and an ink call button, then the address with copy, then the note
  - Төлбөр: a raised receipt ending in a green paid band or a red amount-to-collect band, with "Мөнгө авсан" under it

  The ⋯ sheet edits the address and note, or cancels the order. "TU-д өгөх" stays docked.

- **Савлах** is one parcel at a time as a checklist. Progress segments fill as she ticks. The parcel header has the phone, money, address and note. Each row is the whole tap target: a 112px photo, the name, brand and count, a big ×N, and a square tick that fills teal. Алгасах and Савласан stay docked. After the last parcel come the packed list, the COD total and "N илгээмжийг TU-д өгөх".
- **Шинэ захиалга** has Болих, then the source (Чат, Утас, Дэлгүүр) and one grouped panel for phone, address and note. A known phone shows "N дахь захиалга", fills the last address and lists Өмнө авсан to add again. Below that is a 3-column photo grid: a tap adds one, the tile gets a teal ring and ×N, and sold-out items fade to the end. Then Сагс with steppers and sums, prepay or COD, and a docked "Захиалга үүсгэх · total" that names what's missing until it's ready. A walk-in order has no delivery fee and needs no phone.
- **Бараа** has a large title, search, and rows with photo, name, brand, count and price. The stock number is a button that opens a counter sheet.

Never: stat-card grids, charts, trend arrows, gray uppercase headers, emoji or unicode icons, a floating blue add button, hairline-strip lists, stacked rounded order cards, a loud banner at the top.

## Features

On 2026-10-19 we ran vit-store's admin on a local copy of its data and used it as she does. Each feature below keeps an idea from it and drops the clumsy part. Build them in this order.

1. **The next step on every row.** Each order row in the list ends with one button for its next step: "TU-д өгөх" for an order ready to ship, "Хүргэгдсэн" for one on the road. She doesn't have to open the order. The button turns into [Болих 5] and counts down, and the step runs at 0. COMMERCE-RULES only lets status move forward, so the chance to change her mind comes before the write, not after. vit-store asked for confirmation, and its "…" menu put Delete next to Edit. Here there is no confirm dialog and no delete.
2. **Packing walk-through.** Home's "Савлах" opens the to-ship orders one at a time: big photos with ×N, the address, and the note. She taps each item as it goes in the bag, then "Савласан" moves to the next order. After the last one, a single "N илгээмжийг TU-д өгөх" hands them all to TU. vit-store had a "select N pending" checkbox and a bulk action on top of the list. A packing pass matches what her hands are actually doing.
3. **Tap a photo to enlarge it.** Any product photo opens full screen with brand, strength and count under it. The omegas and D3s look alike at 68px.
4. **Fix the address where it is.** On the order page, tapping the phone, address or note opens a sheet to edit it. Saving goes through `editOrder`, and edits are allowed until the order ships. Phone and address get copy buttons. vit-store had this idea, but with a pencil next to every field and a separate edit page. Here the whole field is the tap target.
5. **Find any order without date filters.** vit-store stacked status tabs, six date buttons, a calendar, a payment dropdown and two sort toggles above the list. Here:
   - Four chips: Илгээх, Төлбөр хүлээж, Замд, Бүгд.
   - Бүгд shows every order, newest first, under day headings (Өнөөдөр, Өчигдөр, Пүрэв 10/16), and loads more as she scrolls.
   - The search field takes a phone or an order number.
   - No date picker, no sort, no payment dropdown.
6. **Fix stock and price from the list.** On Бараа, tapping a stock number opens a counter (− number +) with an optional note, saved through `countStock`. Tapping a price opens a number pad. vit-store's edit form required stock ≥ 1 and price ≥ 20,000, so a sold-out product couldn't be edited (LEGACY.md bug 2). Here, 0 is a normal count.
7. **Who is waiting.** A sold-out product shows how many customers asked to be told when it's back, on Бараа and in home's "Удахгүй дуусна". That count is a reorder signal. vit-store kept it on a separate "Нөөц хүлээлт" page she had to remember to open. Telling the customers it's back comes later.
8. **A phone is the customer.** On the order page, the phone shows the customer's order count ("3 дахь захиалга"), and tapping it lists that phone's orders. There is no separate customers page.
9. **Write an order by hand.** This is the one-line entry from KILL-THE-NOTEBOOK. One idea is kept from vit-store's add form: typing a known phone fills in that customer's last address.

Left out on purpose:

- vit-store's home: income, orders, visitors and profit cards with fake trends, and a 7-day chart. Home already shows every number she acts on.
- Analytics, product import review, brand and category pages, the sidebar, and the neo-brutalist look. These are owner tools or decoration, not her daily work.

## Evidence on Hand

Real product photos, names and prices come from the vit-store catalog. Real customer data stays out of git, deploys and screenshots that get shared. Prototypes use synthetic names, phones and addresses.

## Product Principles

- Packing comes first: what to pull off the shelf and which parcel it goes in.
- Photos before names, because names collide.
- Every number is one she acts on: money to collect, parcels to send, stock to reorder.
- One thumb, standing up.
