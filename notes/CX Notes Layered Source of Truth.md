---
id: 20260425130000
aliases: ["cx layered source of truth", "notes truth model"]
tags: ["cx", "notes", "architecture", "stable"]
target: current
---

`cx` must enforce a layered source-of-truth model instead of treating all repository text as equally authoritative.

## What

The project distinguishes clearly between:

- notes as intent truth
- specs as executable shared-rule truth
- code as implementation truth
- tests as behavioral truth
- docs as communication truth

## Why

Without a layered model, "source of truth" becomes ambiguous and encourages drift between notes, specs, code, and generated docs.

## How

`cx` exposes this model directly in command behavior, validation, extraction, and documentation compilation.

## Links

- [[CX Notes Graph Is the Repository Cognition Layer]]
- [[CX Docs Compile From Notes and Code]]
- [[CX Semantic Drift Detection]]
