---
id: 20260413123200
aliases: ["dirty state", "forced dirty"]
tags: [cx, safety, vcs]
---
# Dirty State Taxonomy

The dirty-state taxonomy separates bundle safety from convenience:
`clean` and `safe_dirty` can proceed, `unsafe_dirty` must stop, and
`forced_dirty` records an explicit operator override with `--force`.

The practical rule is to keep the escape hatch but automate the quarantine.
If a bundle reaches `forced_dirty`, downstream CI should parse the manifest,
reject promotion, and alert on the recorded `modifiedFiles` list instead of
depending on a human to notice terminal warnings.

This keeps hotfix workflows available without letting bypassed safety guards
silently contaminate later automation stages.

## Links

- [[VCS Master Base]] - Dirty-state checks run after the candidate file set is known.
- [[Differential Update Staging]] - `--update` still respects the same safety contract.
- [[AI-first Toolbox]] - Agents need explicit provenance, not hidden
  working-tree drift.
