# Commerce rules

Basic on purpose. A shop doing 20 to 80 orders a day runs on plain statuses, one stock function, and a human for anything weird. If a rule here feels too simple, it's supposed to. Add a rule only when a real order breaks the current ones, and add it here.

## Order status

```text
prepay:  new → paid → shipped → delivered
COD:     new → shipped → delivered
cancel:  from new or paid. Never after shipped.
```

Those are all of them.

- **new**: placed. Stock hasn't moved.
- **paid**: money covers the total. Ready to pack.
- **shipped**: handed to the courier, or picked up.
- **delivered**: the tu-delivery webhook says the customer has it. Pickup and walk-in orders go straight from shipped to delivered.
- **cancelled**: didn't happen.

**COD is for orders mom enters by hand and for chat orders from her chats.** That's how she sells today. The bot, the website and the brand sites are prepay only. A COD order ships unpaid and the money gets recorded when it arrives.

**Auto-cancel:** unpaid prepay orders still `new` after 3 days get cancelled. Stock never moved, so it's harmless. COD orders are never auto-cancelled.

**Status only moves forward.** Whether an order is paid up is its **balance**, not its status (see Payments).

## Stock

- **Stock goes down the first time an order leaves `new`**, to `paid` or to `shipped`, whichever comes first.
- **Stock goes back up when a `paid` order is cancelled.**
- **Stock goes up when a shipment is received.**
- **Counts are corrected by hand with a reason.** Opening counts are corrections too.
- **One function moves stock.** Every move writes a stock-log line: product, change, reason, the order or receipt, who, when. The log is the notebook's "what happened to this product."
- **Stock can go negative.** The order still goes through, and mom gets a ping: "oversold, or the count is wrong." Negative stock is a signal to count, never a reason to block a paid order. The ping fires when a move takes stock below zero, not when a return leaves it still negative. (PR #PAYMENTS)

## Payments

- **Balance = order total minus the sum of its payments.** The dashboard shows it whenever it isn't zero: "owes 20,000₮" or "refund 15,000₮".
- **A `new` order becomes `paid` when its balance reaches zero or below**, from a payment or from an edit that lowers the total.
- **Money is recorded whatever the status.** A QPay payment that lands after auto-cancel still happened. It shows on the cancelled order as a refund owed.
- **A refund can't exceed what the order was paid.**
- **Every payment has a method:** `qpay`, `transfer`, or `cash`.
- **A provider transaction is counted once.** QPay payment IDs and Khaan transaction fingerprints are stored and unique. Cash payments have none.
- **Transfers auto-match only when exactly one open order fits:** the amount equals that order's balance, and the description contains its order number or its customer's phone. Everything else goes to the human queue: zero matches, two matches, too little, too much. (PR #PAYMENTS)
  - The number or phone has to stand alone in the description: `10234` doesn't match inside `102345`.
  - Only orders placed from 14 days before the transfer to 10 minutes after it count, and never cancelled ones.
  - Only incoming whole-tugrik transfers are stored. A fractional credit, like interest, is skipped with a log line.
  - An unmatched transfer stays in `bank_transactions` with no payment, and Telegram gets a ping. Mom assigns it to an order by hand. It then backs her manual transfer payment of the same amount if the order has one, or becomes a new `transfer` payment for whatever it was, short or over.
- **Marked paid by hand, then the bank shows up.** Mom marks an order paid from a screenshot, and later the Khaan sync sees the same transfer. The transfer attaches to her manual payment. It never becomes a second payment. Her payment is a `transfer` with no provider ref; when the bank line arrives with the order's number or phone and the same amount, the sync writes its fingerprint onto her payment. (PR #PAYMENTS)
- **QPay counts what QPay says was paid.** The callback body is never trusted: the callback re-checks the order's invoices with QPay and records each `PAID` payment for QPay's amount, with the QPay payment ID as provider ref. An amount that differs from the invoice shows up in the balance. The cron re-checks invoices younger than 2 hours on orders that still owe, in case a callback never arrives. (PR #PAYMENTS)
- **Refunds are manual.** Customers can't cancel from the storefront or the bot. A bot cancel request is a human handoff. Cancelling a paid order returns the stock and shows "refund X₮". Mom sends the money back herself, then taps "refunded", which records a negative payment so the day's totals stay true.

## Notifications

Telegram's admin chat hears about a new order, an order turning paid, an unmatched transfer and oversold stock, in short Mongolian with the order number and amount. Each one is an `outbox` row written in the same transaction as the change, so a rolled-back write never pings. A dispatcher sends the rows after the QPay callback and on every cron run. It's at least once: a message repeats only when the Worker dies between Telegram's answer and marking the row sent. A row that fails 50 times, about four hours of cron runs, stays unsent for SQL to find. (PR #PAYMENTS)

## Editing an order

- **Allowed until it's shipped.**
- **Stock already moved?** It adjusts by the difference. Add a bottle and stock goes down one. Remove one and it goes up one.
- **The total changed?** The balance shows what's owed or what to refund. The status doesn't change.

## Products

- **A product is one SKU.** "NatureBell D3+K2 240" and "NatureBell D3+K2 120" are two products, with no variants table.
- **Archive products, never delete them.** Old orders point at them.
- **Slugs change with a 301.** Every old slug stays in the slug history.

## Prices and money

- **Prices are integers in ₮.** Supplier prices are integers in USD cents, and the exchange rate is stored on the supplier order.
- **A line keeps the price it was ordered at.** Changing a product's price later never touches old orders.
- **Line prices are editable on manual orders.** That's the whole discount system.
- **Checkout reads prices and stock from Postgres**, never from cache.
- **The delivery fee is stored on the order.** The real default is unconfirmed: the code says 6,000₮ and mom's posts say 5,000₮. See OPERATING_CONTEXT §6.

## Cost

- **Landed cost per unit, in ₮:**
  ```text
  (item USD + shipment shipping USD shared by weight) × the supplier order's FX
  ```
  Shipping runs about $10/kg. Use the real figure for each shipment. No other costs for now.
- **Landed cost is frozen when the shipment is received.** The product's current cost is its latest received landed cost.
- **Every sold line records the product's current cost at the moment stock moves.**
- **Unknown cost is `null`, never `0`.** Everything bought before the opening inventory date is unknown.

## Customers

- **Customers have an ID.** Phone is text, normalized to 8 digits, unique when present. It's nullable, because walk-ins and Messenger-only customers exist.
- **A Messenger customer's page-scoped ID lives in a Messenger identities table** (customer, page, PSID), added with chat orders in T2. One person can write to more than one page.
- **Changing the phone on an order means picking or creating a different customer.** Nothing has a foreign key on a phone number.

## Every order records

- `source`: `messenger_bot`, `messenger_human`, `web`, `brand_site`, `phone`, `walk_in`, `notebook` (digitized old notebook pages)
- `fulfillment_type`: `courier`, `pickup`, `in_store`
- `payment_terms`: `prepay` or `cod`

## Hard lines

- **Cancel orders, never delete them.**
- **The bot and the model go through the same order and payment functions as everything else.** Those functions enforce these rules. The model can create an order from an agreed chat, as a `new` order with source `messenger_human` and one-tap undo. It never records a payment and never moves stock directly.
