---
id: 20260420121300
title: Proof Path Ownership
tags: ["proof", "architecture", "trust"]
target: v0.4
---
The proof path is kernel-owned so render identity, verification, and extraction safety remain auditable even as helpers, plugins, and migration scaffolding evolve around the kernel.

## Includes

- render outputs
- spans
- hashing
- manifest
- extraction
- verification

## Rule

No extension may redefine proof semantics.

## Links

- [[Kernel vs Extension Boundary]]
