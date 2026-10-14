# Agent guide

Amerik huns baraa's store, dashboard, Messenger bot, supply and reels. The goal: mom packs boxes and decides what to buy, software does everything else.

This file holds only what no tool can check. When you see the same mistake twice, make it a type, a lint rule at error, a CI gate or a hook, and fix every existing hit in the same PR. Lint, the Bash hook in `.claude/hooks` and the required `check` already enforce the rest.

## Read first

- [docs/MANIFESTO.md](docs/MANIFESTO.md): why, and the order of battle (§10).
- [docs/private/OPERATING_CONTEXT.md](docs/private/OPERATING_CONTEXT.md): what's true now. Every fact is tagged measured, reported, inferred or decided. Keep the tag you found. `docs/private` is a gitignored clone of the private `darjss/amerik-vitamin-private`, which also holds `legacy/` with real customer data. Never copy anything from it into this public repo.
- [docs/plan/01-launch.md](docs/plan/01-launch.md): the current milestone, its tiers and the settled decisions.
- [GLOSSARY.md](GLOSSARY.md): the shop's terms. Use them as written.

## Read for the task

- How a library works, before reading `node_modules`: [docs/LIBRARIES.md](docs/LIBRARIES.md).
- Solid components or reactivity: [.agents/skills/solidjs-v2/SKILL.md](.agents/skills/solidjs-v2/SKILL.md), and the diagnostics list in LIBRARIES.
- Effect workflows, layers or schemas: [.agents/skills/effect/SKILL.md](.agents/skills/effect/SKILL.md). Installed package types win over examples.
- Writing or reviewing any code (errors, unknown data, types, run edges, database, tests): [docs/CONVENTIONS.md](docs/CONVENTIONS.md).
- Where code goes, request scope, adding an operation or table: [docs/STRUCTURE.md](docs/STRUCTURE.md).
- Effect reads in Solid: [docs/SOLID-EFFECT-BINDING.md](docs/SOLID-EFFECT-BINDING.md).
- Orders, stock, payments, cost, customers: [docs/COMMERCE-RULES.md](docs/COMMERCE-RULES.md).
- Mom's dashboard, manual entry, counting: [docs/KILL-THE-NOTEBOOK.md](docs/KILL-THE-NOTEBOOK.md).
- Dependencies, Workers, database, deploy: [docs/STACK.md](docs/STACK.md).
- vit-store, porting, the bot, the legacy import: [docs/LEGACY.md](docs/LEGACY.md).
- Posts, reels, Zernio: [docs/CREATIVE.md](docs/CREATIVE.md).
- SEO and going live: [docs/RELAUNCH.md](docs/RELAUNCH.md).
- External precedent: `~/dev/tranzfer2-references/README.md` for patterns. `~/dev/tranzfer2-references/apps/executor-v2` is the most concrete reference for Effect on Workers with Postgres and Alchemy, and for `apps/messenger`. `~/dev/tranzfer2` is the shape of this repo. Those checkouts use different prereleases, so verify syntax against installed types.

## How to work

- Smallest direct change. Inferred types, named exports.
- Reach for an established library before hand-rolling anything: webhook signatures, auth, parsing, retries.
- New abstractions, helpers and test files need the owner's approval first. One RuleTester test per custom lint rule in `tools/oxlint/anti-slop/amerik` is pre-approved.
- Never write unit tests after the code. Prefer end-to-end checks that leave a repeatable artifact. Before building a system you will test in isolation, write down every way it can fail, then write the code.
- Use `vp` for everything pnpm or npx would do. Before you call a change done, run `vp check --quiet`, `vp run test` and the relevant `vp run build`, unpiped. Report missing tests or blocked checks as such.
- Pin every version exactly and keep it on the newest release past the release age. When the newest is too new, pin the one before it. Release-age settings and `minimumReleaseAgeExclude` stay untouched. Add packages with `vp add <pkg>@<exact version>`; if `vp add` writes a `minimumReleaseAgeExclude` entry, revert it and pick an older version.
- Opus 5.5 plans, implements and reviews. Hand work to Sonnet or another model only when the owner asks, and then with an exact brief: files, interfaces, done-criteria.
- PRs target `main`, the only merge target. Its required `check` must be green.
- Docs hold standing decisions. When one changes, update its single home and cite the PR. Delete finished plans.

## Parallel work

- At most 3 agents at once, each in its own worktree under `~/dev/scratchpad/amerik-vitamin`, committing after every green step.
- In a shared checkout never `rm`, `git clean`, `git stash` or check out another branch.
- Deploy only from the main checkout, after build and plan review. Never from a worktree.

## Change and verify

- Nobody calls UI done without seeing it. Render it and look in a browser, or run e2e against a deployed preview.
- When a check fails, reproduce it on unchanged `origin/main` before blaming the diff.
- After the same step fails twice, stop and report the exact error and evidence.
- Cap a spike on a prerelease boundary at 30 minutes, then stop and report a repro.
- Keep lint enabled. An exception needs the owner's approval, a file-scoped override and a one-line reason.
- Comments explain runtime quirks and non-obvious constraints.
- The API Worker's Cloudflare and Alchemy resources live in `apps/api/infra`, domain code in `apps/api/src`. `infra/alchemy.run.ts` composes the stack. Each resource has one definition.
- Worker `name` props stay unset. Alchemy derives stage-scoped names, and an explicit name makes every stage overwrite one Worker.

## Hard lines

- No health claims. No "official" or "authorized" wording until the authorization exists.
- Nothing publishes to social without a human tap.
- No agent emails suppliers, Eagle Shine included.
- Commit synthetic fixtures in the real format. Secrets, real customer data and real Amazon order numbers stay out of git.
- The Zernio key for agents is scoped to the pilot page profile only.
