---
id: 20260420130300
title: Diff-Based Extraction Preview
tags: ["extract", "ux", "diff"]
status: design
---
Extraction should provide a preview path before workspace mutation.

## What

Add:

```bash
cx extract --diff
```

## Behavior

- compare bundle content against local files
- use span and hash metadata where available
- print a unified diff
- do not modify files

## Why

Binary degraded extraction can be opaque.

A diff preview provides:

- visibility
- control
- safer decision-making

## Rule

Preview before overwrite.

## Non-goals

- no interactive merge yet
- no automatic reconciliation

## Links

- [[Bundle Extraction Safety Invariants]]
- [[Parity Oracle Policy]]
