---
id: 20260420121300
title: Proof Path Ownership
tags: ["proof", "architecture", "trust"]
target: current
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

## Current boundary

The runtime proof path is now kernel-first:

- XML, Markdown, Plain, and JSON section outputs render through the kernel
- shared handover rendering is kernel-owned
- adapter/oracle code remains only for parity, migration visibility, and compatibility checks

## Links

- [[Kernel vs Extension Boundary]]
