---
id: 20260420124200
title: Friday To Monday Workflow Contract
tags: ["workflow", "contracts", "provenance"]
target: current
---
The Friday-to-Monday path is a workflow contract for turning live investigation into a trusted handoff.

## What

The canonical sequence is:

1. use MCP for live Friday-night exploration on a changing workspace
2. freeze a clean bundle for handoff when the source tree is trustworthy
3. verify that artifact on Monday instead of trusting it by habit

## Why

This path is the operational expression of the Track B to Track A boundary. If it drifts, the system loses its clean distinction between exploratory reasoning and proof-grade artifacts.

## How

The workflow contract depends on stable semantics for:

- dirty-state refusal
- explicit `--force` local review bundles
- bundle manifest and checksum integrity
- Monday verification against artifact or source tree state

## Rule

Friday investigation may be flexible, but Monday trust must stay strict.

## Links

- [[Friday Night Monday Morning Provenance]]
- [[Dirty State Taxonomy]]
- [[Proof Path Ownership]]
- `docs/WORKFLOWS/friday-to-monday.md`
