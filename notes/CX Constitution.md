---
id: 20260420120000
title: CX Constitution
tags: ["architecture", "constitution", "invariants"]
target: current
---
The CX Constitution defines the non-negotiable rules of the system.

## What

CX operates on three epistemic layers:

- Track B: hypothesis (live MCP reasoning)
- Notes: memory (durable cognition)
- Track A: proof (verified artifacts)

## Invariants

- Proof must be deterministic
- Hypothesis must not be promoted automatically
- Memory must not be treated as proof
- All proof must be reproducible and verifiable

## Why

Without a constitution, future changes will erode:

- determinism
- trust boundaries
- reproducibility

## Rule

The constitution overrides convenience.

## Governance consequence

Hard breaks are acceptable only when contracts are explicit, version boundaries are meaningful, and migration safety is proven. If `cx` rejects deprecation layers, it must reject silent breaks as well.

## Links

- [[Render Kernel Constitution]]
- [[System Trust Contract]]
- `docs/modules/ROOT/pages/architecture/mental-model.adoc`
