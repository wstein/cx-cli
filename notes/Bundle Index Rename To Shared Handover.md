---
id: 20260420122000
title: Bundle Index Rename To Shared Handover
tags: ["handover", "naming", "architecture"]
target: v0.4
---
The current term "bundle index" is now too narrow because the file already acts as a shared handover artifact for both humans and agents, not just a lookup-oriented section listing.

## What

The file currently called the bundle index is no longer just an index. It already acts as the shared handover companion for section outputs, and it should evolve into a same-format handover artifact that can also carry bounded repository history.

## Why

"Index" suggests lookup-only metadata. The file now represents:

- section inventory
- provenance summary
- shared operator and AI handoff context
- future repository evolution context

## How

Rename the concept to "shared handover" or "bundle handover".

Preferred direction:

- user-facing term: shared handover
- file naming: `{project}-handover.*`
- documentation should stop centering the term "bundle index"

## Rule

Do not add a second companion file. Rename and evolve the existing one.

## Links

- [[Render Kernel Constitution]]
- [[Kernel vs Extension Boundary]]
- [[Native Render Migration Strategy]]
- `src/render/sectionHandover.ts`
