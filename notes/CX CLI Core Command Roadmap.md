---
id: 20260425131000
aliases: ["cx roadmap", "cx core commands"]
tags: ["cx", "cli", "roadmap", "active"]
target: current
---

The first `cx` note-centric command set focuses on validation, traceability, retrieval, and documentation compilation.

## What

Highest-priority commands are:

- `cx notes check`
- `cx notes graph`
- `cx notes trace`
- `cx notes extract`
- `cx notes ask`
- `cx docs compile`
- `cx docs drift`

Every `cx` CLI command should also be available through MCP for tool-mediated workflows, while LLM agents should call the `cx` CLI directly when they need deterministic local behavior.

## Why

These commands convert the note system from passive markdown into an operational repository interface for humans, LLMs, and CI.

## How

Implement them in that order:

1. validation
2. graph
3. trace
4. extraction
5. asking
6. docs compile
7. drift detection

## Links

- [[CX Notes Extract Is the Retrieval Workhorse]]
- [[CX Notes Ask Needs Evidence Bundles]]
- [[CX Docs Compile From Notes and Code]]
- [[CX Semantic Drift Detection]]
