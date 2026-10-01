# Commerce rules

Basic on purpose. A shop that does 20 to 80 orders a day doesn't need reservations, sagas, or event sourcing. If a rule here feels too simple, it's supposed to. Add complexity only when a real order breaks it.

## Order status

```text
new → paid → shipped → delivered
  ↘ cancelled   (from new or paid, never after shipped)
```

That's all of them. No "processing," no "on hold," no "partially anything."

- **new**: placed, not paid yet.
- **paid**: money confirmed. Ready to pack.
- **shipped**: handed to the courier, or picked up.
- **delivered**: customer has it.
- **cancelled**: didn't happen.

Unpaid `new` orders older than 3 days get cancelled automatically. They never touched stock, so it's harmless.

Cash orders, like pickup or the future physical store, go `new → paid` the moment money changes hands.

## Stock

- **Stock goes down when an order becomes `paid`.** Not before.
- **Stock goes back up when a `paid` order is cancelled.**
- **Stock goes up when a shipment is received.**
- **One function changes stock.** It writes a line to a stock log: product, change, reason, order or shipment, who, when. That log is the notebook's replacement for "what happened to this product."
- **Stock never goes below zero.** If paying would make it negative, the order stays `new` and mom gets a ping: "paid but out of stock." A human decides.
- **Counts can be corrected by hand**, with a reason. That's a log line too.

## Payments

- **The same payment is never counted twice.** Every payment stores the provider's transaction ID (the QPay payment ID or the Khaan transaction ID), and it's unique.
- **Order becomes `paid` when the paid amount covers the total.**
- **Anything weird goes to a human:** too little, too much, a transfer that matches no order, or one that matches two. No guessing.
- **Transfers match on the payment reference plus the amount.** Never on amount alone.

## Editing an order

- **Allowed until it's shipped.**
- If it's already paid, stock adjusts by the difference: add a bottle, stock goes down one; remove one, stock goes up one.
- If the total changes on a paid order, the dashboard shows "customer owes X" or "refund X." It never silently swallows the difference.

## Prices and money

- **Prices are integers in ₮.** Supplier costs are integers in the supplier's currency (USD cents), with the exchange rate stored on the supplier order.
- **A line keeps the price it was ordered at.** Changing a product's price later doesn't change old orders.
- **Checkout reads prices and stock from Postgres**, never from cache.
- **Delivery fee is stored on the order.** The real fee (5,000 vs 6,000₮) is still unconfirmed, see OPERATING_CONTEXT §6.
- **Each sold line records its unit cost at the moment it's paid.** Unknown cost is `null`, never `0`.

## Customers

- Customers have an ID. Phone is text, normalized to 8 digits. One customer per phone.
- Changing the phone on an order means picking or creating a different customer. No foreign keys on phone numbers.

## Every order records

- `source`: messenger_bot, messenger_human, web, brand_site, phone, walk_in
- `fulfillment_type`: courier, pickup, in_store

## Never

- **Never delete orders.** Cancel them.
- **Never delete products.** Archive them. Old orders still point at them.
- **The bot never changes order status or stock.** It calls the same order and payment functions as everything else, and those functions follow these rules.
