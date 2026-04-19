---
id: 20260420121000
title: Native Render Migration Strategy
tags: ["migration", "render", "repomix"]
status: design
---
The render engine must transition from Repomix to a native kernel without changing proof behavior, because migration is only safe when the proof path stays identical while ownership moves inward.

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
