---
id: 20260425130300
aliases: ["cx note claims", "note claim surface"]
tags: ["cx", "notes", "claims", "stable"]
target: current
---

Notes support optional structured claim metadata without becoming executable config files.

## What

A note may declare claims such as:

- decision
- invariant
- mechanism
- failure mode

A claim may include typed refs to specs, code, tests, and docs.

## Why

This gives LLMs, CI, and humans a compact machine-readable summary of what the note asserts and where that assertion is grounded.

## How

`cx` parses optional claim metadata and validates its references, but executable rule values still live in `specs/`.

## Links

- [[CX Notes Traceability Must Be First Class]]
- [[CX Notes Layered Source of Truth]]
- [[CX Semantic Drift Detection]]
