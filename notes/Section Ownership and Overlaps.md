---
id: 20260415161500
aliases: ["overlap resolution", "priority", "dedup"]
tags: [planning, architecture, refinement]
---

`cx` uses a precise ownership model to distribute files from the master list into named sections. A conflict arises when two or more sections match the same file path.

The `analyzeSectionOverlaps` and `getMatchingSections` functions in `src/planning/overlaps.ts` implement the resolution logic.

Key mechanisms:
- **Prioritization**: Sections can specify a `priority` value. When a file matches multiple sections, the one with the highest priority wins.
- **Deduplication Modes**:
  - `fail`: Any overlap is treated as a fatal error (default for production-grade bundles).
  - `warn`: Overlaps are logged as warnings, and the first section (by priority and order) wins.
  - `first-wins`: The file is assigned to the first matching section without warnings.
- **Section Order**:
  - When priorities are equal, the order is governed by `dedup.order` (config position or lexical sorting).
- **Catch-All Section**: A single section can specify `catch_all = true` to absorb all files from the master list that were not claimed by any other section or asset rule.
- **Asset Conflict Detection**: Files that match an asset rule and a section rule concurrently are rejected to ensure clear intent.

This model allows for granular control over how the repository’s files are organized and presented to downstream AI and CI consumers.

When `dedup.mode = "fail"`, the stop is intentional. Allowing duplicate ownership to proceed would mean one source path could be treated as multiple canonical truths in the same bundle, which would break manifest clarity, token accounting, and downstream ownership assumptions.

## Links

- [[Planning Boundary Enforcement]] - Ownership applies only to the master list pool.
- [[Note Graph Audit]] - Overlap resolution can affect which notes are visible in the doc section.
- src/planning/overlaps.ts - Implementation of the overlap and resolution logic.
- docs/doctor/overlaps.ts - Diagnostic tools for overlap resolution.
