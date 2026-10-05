# Agent guide

Amerik huns baraa's store, dashboard, Messenger bot, supply and reels. The goal: mom packs boxes and decides what to buy, software does everything else.

## Read first

- [docs/MANIFESTO.md](docs/MANIFESTO.md): why, and the order of battle (§10).
- [docs/OPERATING_CONTEXT.md](docs/OPERATING_CONTEXT.md): what's true now. Every fact is tagged measured, reported, inferred or decided. Keep the tag you found.

## Read when the task touches it

- Orders, stock, payments, cost, customers: [docs/COMMERCE-RULES.md](docs/COMMERCE-RULES.md).
- Mom's dashboard, manual entry, counting: [docs/KILL-THE-NOTEBOOK.md](docs/KILL-THE-NOTEBOOK.md).
- Dependencies, Workers, database, deploy: [docs/STACK.md](docs/STACK.md).
- vit-store, porting, the bot, the legacy import: [docs/LEGACY.md](docs/LEGACY.md).
- Posts, reels, Zernio: [docs/CREATIVE.md](docs/CREATIVE.md).
- SEO and going live: [docs/RELAUNCH.md](docs/RELAUNCH.md).

## How to work

- Smallest direct change. Inferred types, named exports. No `any`, no casting wrappers.
- New abstractions, helpers and test files need the owner's approval first.
- Use `vp` for everything pnpm or npx would do. After changes run `vp check` and the relevant `vp run build`.
- Pin prerelease versions exactly, and upgrade one package at a time. When a version is too new for the release age, pin an older one. Release-age settings and `minimumReleaseAgeExclude` stay untouched.
- Opus plans and reviews. Sonnet implements from exact briefs: files, interfaces, done-criteria.
- Parallel agents get worktrees under `~/dev/scratchpad/amerik-vitamin`.
- Docs hold standing decisions. When one changes, update its single home and cite the PR. Delete finished plans.

## Hard lines

- No health claims. No "official" or "authorized" wording until the authorization exists.
- Nothing publishes to social without a human tap.
- No agent emails suppliers, Eagle Shine included.
- Commit synthetic fixtures in the real format. Secrets, real customer data and real Amazon order numbers stay out of git.
- The Zernio key for agents is scoped to the pilot page profile only.
