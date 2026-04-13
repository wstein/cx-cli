---
id: 20260413123200
aliases: ["dirty state", "forced dirty"]
tags: [cx, safety, vcs]
---

The dirty-state taxonomy separates bundle safety from convenience: `clean` and `safe_dirty` can proceed, `unsafe_dirty` must stop, and `forced_dirty` is a deliberate audit record that the operator overrode the stop with `--force`.

## Links

- [[VCS Master Base]] - Dirty-state checks run after the candidate file set is known.
- [[Differential Update Staging]] - `--update` still respects the same safety contract.
- [[AI-first Toolbox]] - Agents need explicit provenance, not hidden working-tree drift.
