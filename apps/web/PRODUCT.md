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

The owner picked this on 2026-10-19 after two rounds of phone prototypes. Her most-used apps set the feel: Facebook, Messenger, Instagram, Meta Business Suite and Amazon. The dashboard borrows their habits: photo-first rows, a to-do list with a button on each row and a step tracker on the order. Hierarchy follows iOS lists and the order screens of Shopify, Square, Etsy and Amazon Seller. It copies none of their screens.

The look is "D2", chosen in November 2026 from the v8 prototypes (`prototypes/v8/d2/` in the scratchpad). It takes the storefront's butter and cocoa (`vit-store/apps/storev2`) and rebuilds it on the owner's notes. Earlier rounds were rejected: espresso and clay, cold iOS gray, marigold and lilac, cream and navy hairline strips, stacked rounded order cards, "Native, two-tone" with petrol teal, and D2's own solid ink segmented filter. The owner called a tinted, pill-shaped product photo "the worst", and said the old orders list showed only one order per screen.

One separation rule: white sections on warm cream, split inside by hairlines that start 16px in, like an iOS grouped list. A bold 17px title sits above each section on the cream. No cards stacked on cards, no shadows beyond a 1px lift on a section.

Butter is the one filled action. Ink marks what's selected or done. The other colors are statuses only.

| Token          | Value                                       | Use                                                                         |
| -------------- | ------------------------------------------- | --------------------------------------------------------------------------- |
| page           | `oklch(0.972 0.012 88)`                     | Background                                                                  |
| card           | `#fff`                                      | Sections, fields, the full-size photo                                       |
| ink            | `oklch(0.26 0.02 60)`                       | Text, the selected tab's underline, done stepper dots, ×N badges            |
| inkMuted       | `oklch(0.47 0.025 70)`                      | Secondary text, unselected tabs                                             |
| fill           | `oklch(0.94 0.012 85)`                      | Secondary buttons, search, chips, a pressed row                             |
| line           | `oklch(0.9 0.012 80)`                       | Hairlines, the tab strip's base line, stepper dots not reached yet          |
| butter, edge   | `oklch(0.9 0.14 95)`, `oklch(0.78 0.13 90)` | Every primary action: TU-д өгөх, Савлах, +, call, the selected tab bar item |
| ok on okBg     | `oklch(0.47 0.11 150)`                      | Paid, stock fine, copied                                                    |
| owe on oweBg   | `oklch(0.52 0.17 28)`                       | Not paid, money to collect, sold out, cancel                                |
| wait on waitBg | `oklch(0.5 0.1 70)`                         | Collect at the door, notes she must not miss, "3 хоног", low stock          |
| status.*       | blue, green, purple, gray                   | The dot before an order's status word                                       |

Type is Onest, which has Mongolian's Ө and Ү, with tabular figures on every number. Unbounded is only for a page's large title. Four sizes as Panda text styles in `panda.config.ts`: title 28 (Unbounded), headline and body 17, subhead 15, footnote 13. Icons are Phosphor only.

Rules:

- An action looks like an action. The primary button is butter with a darker edge along its bottom; the next step on a list row is the compact 36px version. Secondary buttons are fill.
- A product photo is the bare bottle on white, square, with no tint, frame or rounded capsule. ×N is a small ink badge on its corner. A tap shows the photo full size, except in the packing checklist and the new-order grid, where a tap does the row's job.
- Every press squeezes to .96 for 120ms. Reduced motion drops the squeeze and the slides.
- The tab bar is one floating capsule with the current tab in butter. A screen's main action is docked at the bottom over frosted material.
- A choice between two or three options is a segmented control with a sliding white thumb.

Screens:

- **Нүүр** opens with the date as a large title. Today's packing comes first: one white section with every bottle to pull off the shelf and its ×N, and a full-width Савлах. Then Хийх (a payment to verify, with Шалгах), Мөнгө (COD left to collect in red, money in today), and Дуусаж байна (low stock with what's left).
- **Захиалга** has the title and a round butter +, then a frosted bar that stays on top while she scrolls: search (order number, or 3 to 8 digits of a phone) and underline tabs with the count inline: Илгээх, Төлбөр хүлээж, Замд, Бүгд. The tabs spread across when they fit and scroll sideways when they don't, and the chosen one always scrolls fully into view. On Илгээх a packing row with three bottles opens Савлах. Orders sit in white sections under day headings (Өнөөдөр, Өчигдөр, Пүрэв 11/6) with the count on the right. Each order is three lines, so four orders of one to three products fit on her phone:
  - the phone, the time, "3 хоног" once a ready order has waited two days, and the total
  - how it's paid (Төлсөн green, Хүргэлтээр amber, Төлөөгүй red), then the address on one line
  - one 40px photo per product with ×N, never folded into "+2", and the next step

  A note she must not miss adds a line between. Tapping the step holds it for 5 seconds as "Болих N" before writing. Customers are known by phone, so no screen shows a name.

- **Order** has a bar with ‹ Захиалга, the number and ⋯. Under it the status pill with its dot, the payment pill, and the source and time. Then:
  - the stepper in a white section, left to right, done in ink and the next stage in butter; COD puts payment last
  - Захиалагч: the phone with "Нийт N захиалга" (a tap lists them) and a round butter call button, then the address with copy, then the note. Tapping the address or note edits them until the order ships
  - Бараа: photo, name, qty × price and the line total, then Нийт with the delivery fee it includes
  - Төлбөр: each payment in green, then what's still owed in red, with "Мөнгө авсан" under the section

  The ⋯ sheet edits the address and note, or cancels the order. The next step stays docked in butter.

- **Савлах** is one parcel at a time as a checklist. Progress segments fill as she ticks. The parcel header has the phone, money, address and note. Each row is the whole tap target: a 112px photo, the name, brand and count, a big ×N, and a square tick that fills ink. Алгасах and Савласан stay docked. After the last parcel come the packed list, the COD total and "N илгээмжийг TU-д өгөх".
- **Шинэ захиалга** has Болих, then the source (Чат, Утас, Дэлгүүр) and one grouped panel for phone, address and note. A known phone shows "N дахь захиалга", fills the last address and lists Өмнө авсан to add again. Below that is a 3-column photo grid: a tap adds one, the tile gets an ink ring and ×N, and sold-out items fade to the end. Then Сагс with steppers and sums, prepay or COD, and a docked "Захиалга үүсгэх · total" that names what's missing until it's ready. A walk-in order has no delivery fee and needs no phone.
- **Бараа** has the title and a round butter +, then a frosted bar that stays on top while she scrolls: search with a Брэнд button beside it, and underline tabs with the count inline: Бүгд, Дууссан (count in red), Дуусаж байна (amber), Тоолоогүй, Архив. Брэнд opens a sheet listing every brand with its count; a picked brand fills the button in ink with its name. Each filter counts what the others leave, and all of them live in the URL, so coming back from a product keeps them. Products sit in one white section, about six to a screen. Each row has a 76px photo, the Mongolian name on up to two lines, then brand · count · form, then the price button that opens the price pad (±5,000₮ steps), the stock button tinted by stock (green, amber when low, red when out, grey when uncounted) that opens one sheet with Тоолсон (set the count) and Ирсэн (add a shipment), and ⋯ for the row's actions: Захиалга үүсгэх, Ирсэн бараа нэмэх, Тоолох, Үнэ өөрчлөх, Нэр, үнэ хуулах, Дэлгэрэнгүй, and Архивлах on its own below. Tapping the row opens the product.
- **Шинэ бараа** has ‹ Бараа and asks what to read from: a photo of the bottle (a white row with a butter camera; the phone camera opens), an Amazon link, or Гараар бөглөх for an empty form. The AI run shows its steps with a seconds counter and keeps going if she leaves; its id stays in the URL. Then comes the filled form: the photos (× drops one), then white sections with each field's name small above its value: Бараа (brand with the shop's brands to pick from, Mongolian name, English name, strength and count), form and category as chips, Үнэ ба үлдэгдэл (Amazon's dollar price as a hint under it), Тайлбар, and line, flavor, base and serving numbers under Бусад мэдээлэл. A note box says what the AI doubted, or that the product is already in the shop with a link to it. The docked "Бараа нэмэх · price" names the missing field until the form is ready.
- **Product** has a bar with ‹ Бараа (back to the same filters), the brand and ⋯, then the photos on white side by side (a tap enlarges one), the Mongolian name and the English one under it. One white section holds Үнэ, which opens the price pad, Үлдэгдэл with what sold in 30 days, which opens the stock sheet, and the four quick actions: Тоолох, Ирсэн, Үнэ, and Захиалах, which opens a new order with the bottle in the cart. "Нэр, үнэ хуулах" copies the name and price for a chat reply. Then Мэдээлэл (the label facts as rows), Найрлага, Тайлбар, and Түүх with the last 30 stock moves, each sale opening its order. ⋯ archives or restores it.

Never: stat-card grids, charts, trend arrows, gray uppercase headers, emoji or unicode icons, a floating blue add button, stacked rounded order cards, a solid segmented filter, tinted or pill-shaped photo tiles, one photo plus "+2", a loud banner at the top.

## Features

On 2026-10-19 we ran vit-store's admin on a local copy of its data and used it as she does. Each feature below keeps an idea from it and drops the clumsy part. Build them in this order.

1. **The next step on every row.** Each order row in the list ends with one button for its next step: "TU-д өгөх" for an order ready to ship, "Хүргэгдсэн" for one on the road. She doesn't have to open the order. The button turns into [Болих 5] and counts down, and the step runs at 0. COMMERCE-RULES only lets status move forward, so the chance to change her mind comes before the write, not after. vit-store asked for confirmation, and its "…" menu put Delete next to Edit. Here there is no confirm dialog and no delete.
2. **Packing walk-through.** Home's "Савлах" opens the to-ship orders one at a time: big photos with ×N, the address, and the note. She taps each item as it goes in the bag, then "Савласан" moves to the next order. After the last one, a single "N илгээмжийг TU-д өгөх" hands them all to TU. vit-store had a "select N pending" checkbox and a bulk action on top of the list. A packing pass matches what her hands are actually doing.
3. **Tap a photo to enlarge it.** Any product photo opens full screen with brand, strength and count under it. The omegas and D3s look alike at 68px.
4. **Fix the address where it is.** On the order page, tapping the phone, address or note opens a sheet to edit it. Saving goes through `editOrder`, and edits are allowed until the order ships. Phone and address get copy buttons. vit-store had this idea, but with a pencil next to every field and a separate edit page. Here the whole field is the tap target.
5. **Find any order without date filters.** vit-store stacked status tabs, six date buttons, a calendar, a payment dropdown and two sort toggles above the list. Here:
   - Four tabs: Илгээх, Төлбөр хүлээж, Замд, Бүгд.
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
