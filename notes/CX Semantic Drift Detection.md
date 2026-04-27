---
id: 20260425130700
aliases: ["cx semantic drift", "notes drift"]
tags: ["cx", "drift", "ci", "stable"]
---

`cx` detects structural note drift today and reserves deeper semantic drift detection as the design target.

## What

The implemented `cx notes drift` command reports:

- a code path moved and broke note references
- a code path exists on disk but is outside the VCS master list
- a code path is tracked but excluded from the active plan
- current-note feature references are stale
- note validation errors that block trustworthy drift inspection

The broader semantic model also cares about cases where a note claim no longer matches specs or docs claim behavior that notes or specs no longer support, but that is not yet the full behavior of `cx notes drift`.

## Why

A note system is only trustworthy if it detects when its claims stop matching the repository.

## How

`cx notes drift` checks structural note-to-code drift and validation health. `cx docs drift` checks generated docs freshness against notes-derived Antora pages. Claim/spec/doc contradiction analysis belongs to the consistency layer and future lint/design work, not to the current `notes drift` command alone.

## Links

- [[CX Notes Traceability Must Be First Class]]
- [[CX Docs Compile From Notes and Code]]
- [[CX Generated Artifacts Must Be Fresh]]
