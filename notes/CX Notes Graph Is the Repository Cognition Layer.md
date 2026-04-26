---
id: 20260425130100
aliases: ["cx cognition layer", "cx note graph"]
tags: ["cx", "notes", "graph", "stable"]
---

The `cx` note graph is the repository cognition layer.

## What

Notes form a typed graph that links:

- notes
- specs
- code files
- tests
- docs

The graph must be queryable by humans, CI, and LLM workflows.

## Why

A folder of markdown files is not enough. The value comes from durable, traversable relationships between decisions, invariants, implementation, and evidence.

## How

`cx notes graph` emits a deterministic machine-readable graph with node types, edge types, backlinks, orphans, and unresolved references.

## Links

- [[CX Notes Traceability Must Be First Class]]
- [[CX Notes Ask Needs Evidence Bundles]]
- [[CX Notes Layered Source of Truth]]
