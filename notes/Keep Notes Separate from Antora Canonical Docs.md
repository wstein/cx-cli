---
id: 20260420183400
title: Keep Notes Separate from Antora Canonical Docs
aliases: []
tags: ["docs", "notes", "antora", "governance"]
target: current
---
The notes graph remains a distinct knowledge surface even after the canonical docs moved to Antora and AsciiDoctor.

## Why

The repository already treats docs and notes as different kinds of knowledge.

Docs are curated, canonical, reader-facing, and intended to express the official model.

Notes are durable cognition artifacts: atomic, historical, exploratory, and sometimes transitional. They are valuable precisely because they can preserve intermediate reasoning and architecture pressure that should not automatically become canonical docs.

## Policy

- `docs/` now publish through Antora and AsciiDoctor from `docs/antora/`
- `notes/` should remain note-native
- selected notes may be promoted into:
  - decision records
  - historical references
  - architecture appendices

Promotion should be intentional, not automatic.

## Promotion criteria

Promote a note only if it becomes:

- stable
- repeatedly referenced
- load-bearing for operators or contributors
- part of the public architecture or release story

## Why this protects you

Without this boundary, a docs migration could accidentally flatten the cognition layer into the official architecture layer.

That would reduce the repository’s ability to preserve exploratory or historical reasoning without prematurely canonizing it.

## Links

- [[Repository Cognition Layer]]
- [[Repomix Decommission Strategy]]
- [[v0.4 Release Closure]]
- [docs/README.md](../docs/README.md)
