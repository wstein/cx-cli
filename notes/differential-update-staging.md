---
id: 202604131233
aliases: ["update mode", "differential update"]
tags: [cx, bundle, operations]
---

`cx bundle --update` is a staging-sync algorithm, not an in-place mutation. It assembles the full bundle in a temporary directory first, then copies the diff into the live output directory and prunes artifacts that no longer belong.

## Links

- [[vcs-master-base]] - The diff is computed from the settled file plan.
- [[dirty-state-taxonomy]] - Update mode does not weaken the dirty-state guard.
- [[ai-first-toolbox]] - Safe differential updates make the agent-facing workflow less brittle.
