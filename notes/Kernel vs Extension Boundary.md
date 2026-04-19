---
id: 20260420110800
title: Kernel vs Extension Boundary
tags: ["architecture", "boundary"]
---

The system enforces a strict boundary between kernel and extensions.

## Kernel owns

- rendering
- spans
- structured plans
- hashing
- manifest
- extraction safety

## Extensions may

- analyze
- report
- augment metadata
- provide alternate views

## Extensions may NOT

- change file ordering
- modify spans
- alter hash inputs
- redefine proof semantics

## Why

Proof must remain stable and auditable.

Extensions must not compromise determinism.

## Links

- [[Render Kernel Constitution]]
- [[System Trust Contract]]
- `docs/SYSTEM_CONTRACTS.md`
