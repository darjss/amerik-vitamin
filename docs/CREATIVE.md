# Creative playbook

For my girlfriend, who owns taste, and for the agents, who make volume underneath it.

## The law

Mom's crude collage outsells every pretty design we've made. It answers three questions at a glance:

1. **What is it?**
2. **How much?**
3. **How do I get it?**

Every post and every reel answers all three. A beautiful creative that skips one of them is a beautiful flop. We've made those already.

## Score

- **DMs and orders. Never likes.** Mom's collage had 1 like and drove chats.
- Every conversation is tagged with the post or reel it came from. The weekly report ranks creatives by orders.
- Money only goes behind creatives that already sold organically. The random $8 boost is dead.

## Materials

- Real product photos from the catalog.
- Real footage: hands holding the bottle, boxes arriving, mom packing orders, a person explaining a product.
- **No AI-generated images or video.** Nobody trusts a supplement shop that can't afford a photo.
- Her layouts as templates, always carrying price, days of supply, and the call to action.
- Arrival collages are rendered from the DB in her layout, from in-stock variants only. See [KILL-THE-NOTEBOOK.md](KILL-THE-NOTEBOOK.md#5-the-collage-comes-out-of-the-db).
- **One shop name per page.** Not three.

## Formats

1. **Catalog reels, automated.** 7 to 15 seconds: hook, product with motion, dose, days of supply, price, "comment ҮНЭ." Rendered from the database, so price and stock are never wrong. 2 to 3 a day per page.
2. **FAQ reels.** Real Messenger questions: expiry, dosage, kids, which magnesium. The April to May 2026 export has the themes.
3. **Arrival reels.** Mom films 10 seconds of a shipment, the pipeline cuts it and adds subtitles, prices and branding. "New stock arrived."
4. **Human reels.** Talking head, UGC style. Agents write scripts and hooks and do the editing.

Seasonal hooks are good, like "before cold season." Then 3 products, one brand, prices, a call to action. No clip art, no swirls, no curved text.

## The loop

```text
reel with "comment ҮНЭ"
  → Zernio comment-to-DM sends a product card
  → the bot takes over and places the order
  → the order is tagged with the reel
  → the weekly report ranks reels by orders
  → make more winners, boost only winners
```

## Zernio specifics

- A single video to Instagram publishes as a Reel. Custom cover, licensed catalog audio (needs Facebook Login), and **Trial Reels** shown only to non-followers that can auto-graduate.
- **Comment-to-DM automations** on Facebook and Instagram, per post or account-wide. A product card carousel can start a bot workflow.
- **Instagram since late August 2026:** buttons and cards in private replies to non-followers get refused, and the failed call burns the one reply allowed per comment. Send plain text first, buttons after they reply.
- **Meta's 24-hour rule:** free-form messages only within 24 hours of the customer's last message. Restock and reorder reminders outside that window need an approved message type, opt-in, or SMS.
- **The pilot** is the small NatureBell and Micro Ingredients page. Agents use a key scoped to that profile only.

## Approval

Every morning the day's rendered creatives go to my girlfriend on Telegram. Approve or reject, one tap. **Nothing she hasn't seen gets published.**

She owns voice, hooks, the calendar, template look, and where money goes.

## Banned

- Health claims: "cures," "treats," "prevents."
- "No.1," "best," and anything we can't prove.
- "Official" or "authorized" before the authorization exists.
- Competitor brands in our creatives.
