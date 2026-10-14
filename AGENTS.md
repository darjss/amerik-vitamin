# Agent guide

Amerik huns baraa's store, dashboard, Messenger bot, supply and reels. The goal: mom packs boxes and decides what to buy, software does everything else.

## Read first

- [docs/MANIFESTO.md](docs/MANIFESTO.md): why, and the order of battle (§10).
- [docs/private/OPERATING_CONTEXT.md](docs/private/OPERATING_CONTEXT.md): what's true now. Every fact is tagged measured, reported, inferred or decided. Keep the tag you found. `docs/private` is a gitignored clone of the private `darjss/amerik-vitamin-private`, which also holds `legacy/` with real customer data. Never copy anything from it into this public repo.
- [docs/plan/01-launch.md](docs/plan/01-launch.md): the current milestone, its tiers and the settled decisions.
- [GLOSSARY.md](GLOSSARY.md): the shop's terms. Use them as written.

## Read for the task

- Solid components or reactivity: [.agents/skills/solidjs-v2/SKILL.md](.agents/skills/solidjs-v2/SKILL.md). Check installed Solid docs and types. For any reactivity change, follow "Change and verify" below.
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

- Smallest direct change. Inferred types, named exports. No `any`, no casting wrappers.
- New abstractions, helpers and test files need the owner's approval first.
- Use `vp` for everything pnpm or npx would do. After changes run `vp check` and the relevant `vp run build`. Report missing tests or blocked checks as such.
- Pin every version exactly and keep it on the newest release past the release age. When the newest is too new, pin the one before it. Release-age settings and `minimumReleaseAgeExclude` stay untouched. Add packages with `vp add <pkg>@<exact version>`, choosing a version past the release age. A too-new version makes `vp add` write a `minimumReleaseAgeExclude` entry; revert that and pick an older version.
- Opus 5.5 plans, implements and reviews. Hand work to Sonnet or another model only when the owner asks, and then with an exact brief: files, interfaces, done-criteria.
- Parallel agents get worktrees under `~/dev/scratchpad/amerik-vitamin`.
- Docs hold standing decisions. When one changes, update its single home and cite the PR. Delete finished plans.

## Change and verify

- When a check fails, reproduce it on unchanged `origin/main` before blaming the diff.
- After the same step fails twice, stop and report the exact error and evidence.
- Keep lint enabled. An exception needs the owner's approval, a file-scoped override and a one-line reason.
- Comments explain runtime quirks and non-obvious constraints.
- The API Worker's resources and bindings live in `apps/api/src/infrastructure` and `index.ts`. `infra/alchemy.run.ts` composes the stack. Each resource has one definition.
- Worker `name` props stay unset. Alchemy derives stage-scoped names, and an explicit name makes every stage overwrite one Worker.
- Only `production` and local `dev_<user>` stages boot. Anything else fails.
- Deploy only from the main checkout, after build and plan review.
- Reactivity changes (components, memos, stores, actions): treat every Solid diagnostic as a defect and never allowlist one you haven't understood. Full repair guide: `apps/web/node_modules/solid-js/skills/reactivity-diagnostics/SKILL.md` (about 6k tokens, search it by code). Most codes come down to:
  - `STRICT_READ_UNTRACKED`, `PENDING_ASYNC_UNTRACKED_READ`: a reactive read outside a tracking scope (destructured props, component body). Read it in JSX, a memo or an effect's compute half; `untrack()` if a one-time snapshot is the intent.
  - `REACTIVE_WRITE_IN_OWNED_SCOPE`, `ACTION_CALLED_IN_OWNED_SCOPE`: a write, `refresh()` or action call during a component body or memo. Move it to an event handler or effect callback.
  - `FLUSH_IN_ACTION`, `FLUSH_IN_EFFECT_CALLBACK`: delete the `flush()`. In tests, call `flush()` before reading the DOM.
  - `NO_OWNER_EFFECT`, `NO_OWNER_CLEANUP`: create effects and `onCleanup` under a component or `createRoot`.
  - `UNSTABLE_MEMO_OUTPUT`: the memo returns fresh but equal objects. Return stable references or pass `equals`.
  - `HOT_SCOPE_*`, `HUGE_FAN_OUT`: a hot signal or one shared value read by many rows. Derive a slower value, or keep the answer in a store keyed by id.
  - `EFFECT_WRITES_OWN_SOURCE`, `EFFECT_RELAY_TEAR`: an effect that writes derived state. Use `createMemo`.
  - `IMMUTABLE_UPDATE_IN_STORE`, `UNSTABLE_LIST_IDENTITY`: mutate the store draft, or `reconcile(data, "id")`, and key `<For>` by a stable id.
  - `ASYNC_WATERFALL`: read every async source before using any, so they start together.
  - `SILENT_HOLD`, `LONG_HOLD`: add feedback with `isPending`, `latest` or an optimistic write. Never remove the hold; past 500 ms show a `Loading` fallback.

## Hard lines

- No health claims. No "official" or "authorized" wording until the authorization exists.
- Nothing publishes to social without a human tap.
- No agent emails suppliers, Eagle Shine included.
- Commit synthetic fixtures in the real format. Secrets, real customer data and real Amazon order numbers stay out of git.
- The Zernio key for agents is scoped to the pilot page profile only.
