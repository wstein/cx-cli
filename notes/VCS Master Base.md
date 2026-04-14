---
id: 20260413123100
aliases: ["master base", "VCS-derived master list"]
tags: [cx, planning, vcs]
---

# VCS Master Base

`cx` planning starts from the VCS-derived master base, not a blind filesystem
crawl. Section globs classify files that already exist in that base; they do
not invent new membership.

## Links

- [[Dirty State Taxonomy]] - The master base is classified before the working tree is accepted or rejected.
- [[Differential Update Staging]] - The update algorithm replays the settled plan into a temp staging tree.
- [[AI-first Toolbox]] - This keeps the agent-facing surface deterministic.
