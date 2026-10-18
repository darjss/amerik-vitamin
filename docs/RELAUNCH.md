# Relaunch checklist

The site was pulled from Search Console and the Facebook page went quiet while registration happens. Relaunch is when registration clears and marketing turns on. This is the day-of list.

## Before the day

- [ ] Mom is off manual duty: the bot is live, payments confirm themselves, dispatch is automatic, and the dashboard replaced the notebook. **Marketing never turns on before this.**
- [ ] Stock counted, and the opening inventory date is set.
- [ ] Wording approved: "official" or "authorized" only if the authorization allows it, registration or permit numbers on product pages, no health claims.
- [ ] Delivery fee confirmed, 5,000 or 6,000₮, the same in posts, bot and checkout.
- [ ] The server components gate passed on a deployed Worker (see STACK.md).

## SEO

- [ ] **301 map:** every old vit-store URL goes to its new URL in one hop. That covers `/products/{slug}-{id}/`, old slugs, brand and category pages. Old URLs never 404.
- [ ] A database-driven `sitemap.xml` per host, with real `lastmod` and only canonical, indexable URLs.
- [ ] Product JSON-LD: name, image, brand, `gtin`, offer with price and availability, shipping and return details. Organization logo as PNG.
- [ ] Canonicals: brand-site products are canonical on the brand site, and amerikvitamin.mn points to them.
- [ ] OG images are PNG, not SVG, and cacheable.
- [ ] `robots.txt` per host points to that host's sitemap.
- [ ] Remove the `X-Robots-Tag: noindex` middleware in `apps/web/src/middleware.ts`.

## Search Console

- [ ] Cancel the temporary removals on amerikvitamin.mn.
- [ ] Add naturebell.mn and microingredients.mn as properties.
- [ ] Submit each sitemap. Request indexing for the home page and top products.
- [ ] Watch coverage for a week: 404s, redirect chains, "duplicate without canonical."

## Meta

- [ ] Main page and pilot page connected in Zernio, with comment-to-DM automations live.
- [ ] Instagram accounts connected.
- [ ] The first week of creatives approved and scheduled.
- [ ] Boost budget set by my girlfriend, spent only on posts that already sold.

## After

- [ ] Daily for 2 weeks: orders by source, bot handoff rate, unmatched payments, stockouts.
- [ ] Weekly: orders per creative, conversations to orders, first reply time.
