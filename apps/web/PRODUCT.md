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

Palette "espresso and clay". Color means a status or what's selected, never decoration.

| Token       | Value                  | Use                                                         |
| ----------- | ---------------------- | ----------------------------------------------------------- |
| page        | `#faf5ef`              | Background                                                  |
| surface     | `#fffdfa`              | Cards, tab bar, bottom dock                                 |
| ink         | `#2a1d16`              | Text                                                        |
| ink-muted   | `#786a60`              | Secondary text, 4.8:1 on page                               |
| line        | `#ece2d7`              | Dividers, card and photo outlines                           |
| chip        | `#f1e8de`              | Filter chips, secondary buttons, icon circles               |
| espresso    | `#33241d`              | Main buttons, white text                                    |
| clay        | `#bf4f2c`              | Selected tab, active filter, ×N counts, white text at 4.8:1 |
| paid        | `#3b6338` on `#e4eedf` | QPay or Khaan paid                                          |
| owes        | `#9c2348` on `#f9e0e6` | Money to collect, QPay waiting                              |
| not shipped | `#6b5210` on `#f4e9cc` | Not handed to TU yet                                        |

Type is the system font, which is SF Pro on her iPhone and covers Cyrillic. Numbers use tabular figures. Icons are Phosphor only.

Screens:

- **Orders** (Захиалга) opens on the to-ship filter (Илгээх). Three or four orders fit on one iPhone screen. Each row shows product photos with the piece count, phone, order number, items, address, a collect or paid label and a not-shipped label. Customers are known by phone, so no screen shows a customer's name. A search field for phone or order number sits above the filter chips.
- **Home** (Нүүр) shows money in today next to COD left to collect. Below that is Хийх зүйлс, a to-do list with one button per row, such as Савлах, Холбох, Буцаах or Захиалах. Then come the shelf to pull from today, with ×N on each photo, and stock running low.
- **Order** shows where it stands in one line, then a four-step tracker (Захиалсан, Төлсөн, Илгээсэн, Хүргэсэн). Below are the customer with call and copy-address buttons, items with photos, and payment. One "TU-д өгөх" button stays docked at the bottom.

Never: stat-card grids, charts, trend arrows, gray uppercase headers, emoji or unicode icons, a floating blue add button.

## Features

On 2026-10-19 we ran vit-store's admin on a local copy of its data and used it as she does. Each feature below keeps an idea from it and drops the clumsy part. Build them in this order.

1. **The next step on every row.** Each order row in the list ends with one button for its next step: "TU-д өгөх" for an order ready to ship, "Хүргэгдсэн" for one on the road. She doesn't have to open the order. A toast holds the step for 5 seconds with [Болих], then runs it. COMMERCE-RULES only lets status move forward, so the chance to change her mind comes before the write, not after. vit-store asked for confirmation, and its "…" menu put Delete next to Edit. Here there is no confirm dialog and no delete.
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
