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
- rendered bundle artifacts
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
- scanner selection must stay explicit through bounded scanner IDs

## Non-goals

- open-ended scanner loading
- plugin-defined proof-path scanners
- silent scanner activation based on installed packages

## Why

Security must be extensible but deterministic.

## Current state

- source-stage scanning is implemented
- optional post-pack artifact scanning is implemented
- doctor diagnostics and bundle enforcement share the same pipeline seam
- the current bounded core scanner set contains `reference_secrets`

## Post-v0.4

- additional core scanners
- richer CI rollout and policy shaping
- any extension/plugin scanner model above the current bounded seam

## Links

- [[Plugin Capability Tiers]]
- [[Bundle Extraction Safety Invariants]]
- [[Internal API Stabilization]]
- [[v0.4 Release Closure]]
- `src/doctor/scanner.ts`
