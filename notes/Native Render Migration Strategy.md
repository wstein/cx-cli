---
id: 20260420121000
title: Native Render Migration Strategy
tags: ["migration", "render", "repomix"]
target: v0.4
---
The render engine must transition from Repomix to a native kernel without changing proof behavior, because migration is only safe when the proof path stays identical while ownership moves inward. XML, Markdown, Plain, JSON, and the shared handover now run through kernel-owned paths, native structured-plan construction now belongs to the kernel, adapter-plan extraction exists only for parity comparison, and the Repomix path is now parity-only rather than a hidden runtime fallback; the remaining work is shrinking the oracle boundary until it no longer defines the runtime proof path at all.

## Phases

1. freeze render contract
2. implement native kernel
3. validate parity against oracle
4. switch default
5. remove external dependency

## Rule

Proof-path behavior must remain identical during migration.

## Why

Migration discipline matters more than implementation speed. A renderer swap that changes proof semantics, even slightly, creates a false sense of compatibility while silently invalidating extraction and verification trust.

## Links

- [[Repomix Decommission Strategy]]
- [[Render Kernel Constitution]]
- [[Parity Oracle Policy]]
