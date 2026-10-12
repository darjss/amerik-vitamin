# Legacy findings

What two years of vit-store and its earlier repos actually did, mined from 9 repos of git history and 1,044 agent sessions in 2026. It sits next to [../LEGACY.md](../LEGACY.md): LEGACY.md says what not to repeat, and these files say where it came from and what the owner kept asking agents to do.

| File                                 | What it is                                                                                                                                                                                                                       |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [reality-check.md](reality-check.md) | The short version. Where the time and tokens went, and why the rewrite has to start from the notebook.                                                                                                                           |
| [agent-history.md](agent-history.md) | What the owner asked agents to do from Jan to Sep 2026: business rules, the domain model the rewrite needs, workflows, integrations, recurring chores, decisions and reversals. Input for the new design.                        |
| [archaeology.md](archaeology.md)     | Where each of the 12 LEGACY.md bugs was born. Also why ADR 0012 has a 12-hour timer, when each cache layer appeared, and the nastiest bugs fixed with models.                                                                    |
| [prehistory.md](prehistory.md)       | The 8 repos before amerik-vitamin, read commit by commit. Includes the schema lineage and the 2025-01-16 commit that deleted variants.                                                                                           |
| [analytics.md](analytics.md)         | What customers actually did, from PostHog: launch spike, outage, the noindex drop, Facebook in-app traffic, bank hand-off failures, searches, top products, errors. [analytics.html](analytics.html) is the interactive version. |
| [timeline.html](timeline.html)       | Interactive timeline, Oct 2024 to Oct 2026, with 118 milestones. Open it in a browser.                                                                                                                                           |
| [stats.html](stats.html)             | Token and session stats: harnesses, models, categories, prompting hours. Open it in a browser.                                                                                                                                   |

Sources and caveats:

- Agent sessions before 2026-01-12 were lost to a laptop reinstall, so for that period git is the only record. Code from then was a mix of Cursor agents, ChatGPT and DeepSeek copy-paste, and hand edits.
- Claude Code kept prompts but not token counts. Cursor kept almost no token counts.
- Session tags come from a Sonnet reader and are rough for orchestrated subagent sessions.
- These files contain real customer and order data. Keep this repo private.

Raw extracts (normalized session JSONL, extractor scripts) are not committed. The source copies of agent-history, stats and timeline also live in vit-playground under `reports/agent-history-2026/`.
