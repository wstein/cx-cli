---
id: 20260420130000
title: Overlap Strict Mode
tags: ["bundle", "determinism", "sections"]
status: design
---
Overlap resolution must be explicit in strict environments.

## What

Introduce:

```toml
[dedup]
require_explicit_ownership = true
```

When enabled:

- any file claimed by multiple sections must have a clear winner
- priority ties are not allowed
- lexical or config-order fallback is forbidden

## Why

Implicit fallback through lexical ordering or config order introduces silent context loss.

This conflicts with:

- deterministic bundling
- explicit trust boundaries
- proof-path guarantees

## Behavior

- default: current fallback behavior remains available
- strict mode: fail the build on ambiguity

## CI

High-assurance CI should enable strict overlap mode.

## Rule

The system must not guess section ownership in proof paths.

## Links

- [[Section Ownership and Overlaps]]
- [[Render Kernel Constitution]]
- [[Release Proof Criteria]]
