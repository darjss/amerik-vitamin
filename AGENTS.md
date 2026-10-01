# Agent guide

Amerik huns baraa's store, dashboard, Messenger bot, supply and reels. The goal: mom packs boxes and decides what to buy, software does everything else.

## Read first

- [docs/MANIFESTO.md](docs/MANIFESTO.md): why.
- [docs/OPERATING_CONTEXT.md](docs/OPERATING_CONTEXT.md): what's true right now. Facts are marked measured, reported, inferred or decided. Don't upgrade them.
- Orders, stock, payments: [docs/COMMERCE-RULES.md](docs/COMMERCE-RULES.md). Keep it basic.
- Mom's dashboard and manual entry: [docs/KILL-THE-NOTEBOOK.md](docs/KILL-THE-NOTEBOOK.md).
- Tools and versions: [docs/STACK.md](docs/STACK.md).
- Anything ported from vit-store: [docs/LEGACY.md](docs/LEGACY.md) first.
- Posts, reels, Zernio: [docs/CREATIVE.md](docs/CREATIVE.md).
- Going live: [docs/RELAUNCH.md](docs/RELAUNCH.md).

## How to work

- Smallest direct change. Inferred types, named exports. No `any`, no casting wrappers.
- New abstractions, helpers, and test files need the owner's approval first.
- Use `vp`, not pnpm or npx. After changes run `vp check` and the relevant `vp run build`.
- Never add `minimumReleaseAgeExclude` entries or loosen release-age settings. Pin an older version instead.
- Pin prerelease versions exactly. Upgrade on purpose, one package at a time.
- Implementation and verification go to SWE-2 with exact briefs: files, interfaces, done-criteria. Opus plans and reviews.
- Parallel agents get worktrees under `~/dev/scratchpad/amerik-vitamin`.
- Docs hold standing decisions. When one changes, update the doc and cite the PR. Delete finished plans.

## Hard lines

- No health claims. No "official" or "authorized" wording until the authorization exists.
- Nothing publishes to social without a human tap.
- No agent emails suppliers, Eagle Shine included.
- Never commit secrets, real customer data, or real Amazon order numbers. Use synthetic fixtures in the same format.
- The Zernio key for agents is scoped to the pilot page profile only.
