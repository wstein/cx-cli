---
id: 20260420121000
title: Native Render Migration Strategy
tags: ["migration", "render", "repomix"]
status: design
---

The native render migration is only valid if it preserves proof behavior exactly, because replacing a proof-path dependency is safe only when outputs, spans, and verification meaning stay identical.

## Phases

1. freeze render contract
2. implement native kernel
3. run parity against legacy oracle
4. switch default
5. remove dependency

## Rule

No migration phase may change:
- proof-path output
- spans
- token accounting
- manifest semantics

## Why

Migration discipline matters more than implementation speed. A renderer swap that changes proof semantics, even slightly, creates a false sense of compatibility while silently invalidating extraction and verification trust.

## Links

- [[Repomix Decommission Strategy]]
- [[Render Kernel Constitution]]
