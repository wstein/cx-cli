---
id: 20260420120500
title: Scanner Pipeline Contract
tags: ["security", "scanner"]
target: current
---
Security scanning is a pluggable pipeline, not a renderer feature.

## What

Scanners evaluate:

- source files
- packed content
- manifests

## Output

- structured findings
- scanner id
- stage
- severity
- optional gating
- pre-pack and optional post-pack enforcement via `fail` or `warn`

## Rule

- core scanners may block proof
- extensions may only warn unless promoted

## Why

Security must be extensible but deterministic.

## Links

- [[Plugin Capability Tiers]]
- [[Bundle Extraction Safety Invariants]]
- [[Internal API Stabilization]]
- `src/doctor/scanner.ts`
