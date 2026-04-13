---
id: 202604131231
aliases: ["master base", "VCS-derived master list"]
tags: [cx, planning, vcs]
---

The planner's real starting point is the VCS-derived master base, not a blind filesystem crawl. Section globs classify files that already exist in that base; they do not invent new membership.

## Links

- [[dirty-state-taxonomy]] - The master base is classified before the working tree is accepted or rejected.
- [[differential-update-staging]] - The update algorithm replays the settled plan into a temp staging tree.
- [[ai-first-toolbox]] - This keeps the agent-facing surface deterministic.
