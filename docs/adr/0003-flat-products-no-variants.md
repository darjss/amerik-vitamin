# One flat products table, no variants table

Each product row is one sellable SKU. A plain `line` field groups products like "Vitamin D3 + K2" without a parent table. Every page, price and stock count belongs to exactly one SKU, so a parent table would only add joins. What actually caused the duplicates was missing identity, so the fix is a unique key on brand, line, potency, count, form and flavor, plus a unique ASIN. This overrides the variant model suggested in `docs/private/legacy/agent-history.md` and KILL-THE-NOTEBOOK §5.
