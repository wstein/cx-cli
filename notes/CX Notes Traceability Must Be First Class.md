---
id: 20260425130200
aliases: ["cx traceability", "note trace"]
tags: ["cx", "notes", "traceability", "stable"]
---

`cx` treats traceability as a first-class capability instead of a side effect of markdown links.

## What

Each note may point to:

- spec refs
- code refs
- test refs
- doc refs
- superseded notes

These references should be validated and queryable.

## Why

If a note cannot be traced to executable rules, implementation, tests, and docs, it cannot function as reliable repository memory.

## How

`cx notes trace <note-id>` expands all linked evidence and backlinks. `cx notes check` fails when typed references are broken or unresolved.

## Links

- [[CX Notes Graph Is the Repository Cognition Layer]]
- [[CX Semantic Drift Detection]]
- [[CX Notes Claim Metadata]]
