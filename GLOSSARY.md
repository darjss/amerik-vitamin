# Amerik Vitamin

The shop's language: what it sells, who buys, and how an order moves. Rules about these terms live in [docs/COMMERCE-RULES.md](docs/COMMERCE-RULES.md).

## Catalog

**Product**:
One sellable SKU, identified by brand, line, potency, count, form and flavor. D3+K2 5,000 IU 300 softgels and D3+K2 10,000 IU 300 softgels are two products.
_Avoid_: variant, item, listing, SKU row

**Line**:
The formula a product belongs to within its brand, such as "Vitamin D3 + K2". It groups products. It is not a product.
_Avoid_: product family, parent product, base product

## People

**Customer**:
A person who has placed at least one order, identified by phone. Someone who only chats is not a customer.
_Avoid_: user, client, contact, lead

**Admin**:
One of the people on the dashboard allowlist: the owner, mom, and the creative lead. All admins can do everything.
_Avoid_: staff, operator, user

## Orders

**Order number**:
The digits a person sees and says for an order, like `#10234`. Customers also type it as the reference on a bank transfer.
_Avoid_: order code, payment number, payment reference

**Prepay**:
Payment terms where money arrives before the order ships. Every bot and website order is prepay.
_Avoid_: paid order, online order

**COD**:
Payment terms where an order ships unpaid and the money arrives on delivery. Only admins create COD orders.
_Avoid_: pay later, cash order

**Balance**:
An order's total minus the sum of its payments. Positive means the customer owes; negative means a refund is due.
_Avoid_: debt, remaining, amount due

**Stock move**:
One logged change to a product's stock, with a reason. A sale, a cancellation, a receipt and a count are all stock moves.
_Avoid_: inventory adjustment, stock update

## Messenger

**Handoff**:
The bot giving a chat to a human. The bot stays silent until an admin gives the chat back.
_Avoid_: escalation, takeover, pause
