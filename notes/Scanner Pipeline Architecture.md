---
id: 20260420110300
title: Scanner Pipeline Architecture
tags: ["security", "scanner", "pipeline"]
status: design
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

## Trust rule

- core scanners may block proof path
- extension scanners may only warn unless promoted

## Future

- multi-stage scanning (pre-pack, post-pack)
- CI gating integration
- policy-based activation

## Links

- [[Bundle Extraction Safety Invariants]]
- [[System Trust Contract]]
- `src/repomix/render.ts`
