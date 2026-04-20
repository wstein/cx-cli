---
id: 20260420110300
title: Scanner Pipeline Architecture
tags: ["security", "scanner", "pipeline"]
target: current
---
`security_check` evolves into a pluggable scanner pipeline.

## What

A scanner pipeline evaluates bundle inputs or outputs:

- secrets detection
- policy violations
- unsafe content patterns

## Why

Security cannot be tied to a single adapter implementation.

It must be:

- extensible
- auditable
- deterministic

## How

Scanner interface:

- input: source or packed content
- output: structured findings
- optional: fail/warn gating

Current implementation:

- source-stage scanning before proof artifacts are finalized
- optional post-pack scanning over rendered section outputs, shared handover, and manifest
- doctor diagnostics and bundle enforcement share the same pipeline seam
- scanner selection is explicit through bounded scanner IDs

## Non-goals

- turning scanner configuration into a plugin registry
- making proof blocking depend on implicitly discovered scanners
- reopening `v0.4` with a broader extension architecture

## Trust rule

- core scanners may block proof path
- extension scanners may only warn unless promoted

## Future

- CI gating integration
- policy-based activation
- additional bounded core scanners

## Links

- [[Bundle Extraction Safety Invariants]]
- [[System Trust Contract]]
- [[v0.4 Release Closure]]
- `src/adapter/oracleRender.ts`
