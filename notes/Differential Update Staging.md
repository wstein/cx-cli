---
id: 20260413123300
aliases: ["update mode", "differential update"]
tags: [cx, bundle, operations]
---

# Differential Update Staging

`cx bundle --update` stages a complete bundle in a temporary directory first,
then syncs the diff into the live output directory and prunes artifacts that no
longer belong.

## Links

- [[VCS Master Base]] - The diff is computed from the settled file plan.
- [[Dirty State Taxonomy]] - Update mode does not weaken the dirty-state guard.
- [[AI-first Toolbox]] - Safe differential updates keep the agent-facing workflow
  stable.
