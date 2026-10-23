# Amerik Vitamin

The shop's language: what it sells, who buys, and how an order moves. Rules about these terms live in [docs/COMMERCE-RULES.md](docs/COMMERCE-RULES.md).

## Catalog

**Product**:
One sellable SKU, identified by brand, line, potency, count, form, flavor and base. D3+K2 5,000 IU 300 softgels and D3+K2 10,000 IU 300 softgels are two products, and so are the same D3+K2 in sunflower seed oil and in coconut oil. Its English and Mongolian names are built from those fields, so no two products share a name.
_Avoid_: variant, item, listing, SKU row

**Base**:
The carrier oil a softgel or liquid's active ingredient sits in, e.g. coconut oil. Empty when the oil is the product itself, as in fish oil.
_Avoid_: carrier, oil variant

**Label**:
The bottle's printed panel in English: supplement facts per serving, other ingredients, allergens, free-of claims, suggested use, warnings and certifications. Read from the product's iHerb listing, or its Amazon page when iHerb has none.
_Avoid_: ingredients text, specs

**Collage**:
A price-labelled grid of product photos that mom posts to Facebook. The catalog is read from collages.
_Avoid_: catalog image, price list, post

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
Payment terms where an order ships unpaid and the money arrives on delivery. Admin orders and chat orders can be COD; bot and website orders never are.
_Avoid_: pay later, cash order

**Balance**:
An order's total minus the sum of its payments. Positive means the customer owes; negative means a refund is due.
_Avoid_: debt, remaining, amount due

**Chat order**:
An order a model created from a human Messenger chat once the customer agreed. It can be undone with one tap.
_Avoid_: draft, auto order, extracted order

**Supplier order**:
A purchase we make from Amazon, Eagle Shine or another supplier.
_Avoid_: purchase, PO, shipment, import

**Stock move**:
One logged change to a product's stock, with a reason. A sale, a cancellation, a receipt and a count are all stock moves.
_Avoid_: inventory adjustment, stock update

## Messenger

**Handoff**:
The bot giving a chat to a human. The bot stays silent until an admin gives the chat back.
_Avoid_: escalation, takeover, pause
