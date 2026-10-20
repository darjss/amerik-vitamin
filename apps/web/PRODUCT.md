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

Palette "cream and navy", chosen 2026-10-20 over espresso and clay, which tinted every surface brown. Cream is only the page. Everything she taps is surface white or navy. Navy is the one strong color: no status and almost no bottle in the catalog is navy, so it never gets mixed up with paid, owed or a product photo. Solid navy marks the main button, the active filter, ×N on photos and done steps. Soft navy marks quieter things next to a navy button: the active tab, ×N on the order page, "3 дахь захиалга". Color means a status or what's selected, never decoration.

| Token       | Value                  | Use                                                                       |
| ----------- | ---------------------- | ------------------------------------------------------------------------- |
| page        | `#f8f4ec`              | Background                                                                |
| surface     | `#fffdf9`              | Blocks, buttons, chips, search fields, tab bar, bottom dock               |
| ink         | `#151a28`              | Text, a navy-black                                                        |
| ink-muted   | `#6b6862`              | Secondary text                                                            |
| line        | `#e9e3d8`              | Dividers, button and photo outlines                                       |
| chip        | `#efeae0`              | Segmented control track, a main button that isn't ready                   |
| navy        | `#1d2d50`              | Main button, active filter, ×N on photos, done steps, held row, call icon |
| navy-soft   | `#e2e7f3`              | Active tab pill, ×N on the order page, repeat-customer tag                |
| paid        | `#2f6b3a` on `#e5efe2` | QPay or Khaan paid                                                        |
| owes        | `#b4233c` on `#fbe6e8` | Money to collect, QPay waiting                                            |
| not shipped | `#8a5a00` on `#f8ecce` | Not handed to TU yet                                                      |

Type is Onest. It was drawn for Cyrillic screens and has Mongolian's Ө and Ү. Bold is for the phone, money and ×N only. Numbers use tabular figures. Icons are Phosphor only.

Lists run edge to edge as full-width blocks with hairlines, not rounded cards, with page color between blocks. Sections carry a bold heading with a navy Phosphor icon (Бараа, Хүргэх, Төлбөр, Мөнгө) so the page has landmarks.

An action looks like an action. The next step on every order row is a solid navy button, as vit-store's yellow "Хүргэсэн" was; on a to-do list each row's step is that row's main action. An outlined step read as a label, and the screens felt dead. Buttons press down a little when tapped. COD money is the heaviest text on a row: "Хүргэлтээр авах" over a bold red amount. A note (door code, "call first") sits in a pale yellow box. There is no loud banner at the top; the number to act on rides in a pinned bar above the tab bar. Every other button, the call and copy circles included, is surface color with a hairline outline; a tan fill read as dirty on her screen. A choice between two or three options is an iOS segmented control: a chip track with a white thumb, not filled color buttons. A dark button that isn't ready yet turns chip with muted text that says what's missing.

Screens:

- **Orders** (Захиалга). A large "Захиалга" title with a round + for a new order, then the search field. Search takes an order number, or any 3 to 8 digits of a phone. The filter chips show counts: Илгээх 4, Төлбөр хүлээж 1, Замд 3. On Илгээх, a navy bar pinned above the tab bar says "4 илгээмж · 9 ширхэг" and opens Савлах; it stays under her thumb while she scrolls.
  Each row has:
  - the phone, with the money on the right (bold red "Хүргэлтээр авах 286,000₮", or a "Төлсөн" pill)
  - the address on one line
  - the note in full, in a note box
  - one 64px photo per product, each with its own ×N
  - the solid next-step button
  - a "2 хоног" pill when a ready order has waited two days or more

  Customers are known by phone, so no screen shows a customer's name.

- **Home** (Нүүр) opens with the date. Then comes the morning's packing: how many parcels, Савлах, and every bottle to pull off the shelf with ×N, all visible at once. Хийх зүйлс holds only rows with a button. Мөнгө is two plain rows: COD left to collect, and money in today. Stock running low comes last.
- **Order** reads top to bottom:
  - the status in one line
  - a muted line with payment, time and source
  - a thin four-step tracker
  - Бараа: the items with 72px photos
  - Хүргэх: the phone, with how many orders it has placed and a call button; the address, with a copy button; the note in a note box
  - Төлбөр: the lines and the total
  - "Мөнгө авсан", which records cash or a transfer she took by hand

  The ⋯ menu edits the address and note, or cancels the order. One "TU-д өгөх" button stays docked at the bottom.

- **New order** (+). She picks where it came from (Чат, Утас, Дэлгүүр), then fills phone, address and note in one grouped block with an icon on each row. A known phone fills in the last address, says which order this is ("3 дахь захиалга") and shows "Өмнө авсан", the products it bought before, one tap to add again. Every product sits in a three-column photo grid with name, count, brand and price; a tap adds one, the tile gets a navy ring and ×N, and sold-out ones fade to the end. The search field narrows the grid. Chosen items collect in Сагс with +/- steppers. Prepay or COD and "Захиалга үүсгэх · total" stay docked at the bottom. A walk-in order has no delivery fee and needs no phone.
- **Бараа**. A search field, and a list with photo, price and stock. A tap on the stock opens a counter that saves the count.

Never: stat-card grids, charts, trend arrows, gray uppercase headers, emoji or unicode icons, a floating blue add button.

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
