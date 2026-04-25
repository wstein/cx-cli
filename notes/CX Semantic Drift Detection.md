---
id: 20260425130700
aliases: ["cx semantic drift", "notes drift"]
tags: ["cx", "drift", "ci", "stable"]
target: current
---

`cx` detects semantic drift, not only structural markdown errors.

## What

Drift includes cases where:

- a note claim no longer matches specs
- a spec changed without linked notes being updated
- a code path moved and broke note references
- docs claim behavior that notes or specs no longer support

## Why

A note system is only trustworthy if it detects when its claims stop matching the repository.

## How

`cx notes drift` and `cx docs drift` compare note claims, specs, code refs, tests, and generated docs, then fail CI on unresolved mismatches.

## Links

- [[CX Notes Traceability Must Be First Class]]
- [[CX Docs Compile From Notes and Code]]
- [[CX Generated Artifacts Must Be Fresh]]
