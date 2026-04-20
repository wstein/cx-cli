---
id: 20260420124100
title: Workflow Contracts
tags: ["workflow", "contracts", "operations"]
target: current
---
Operator workflows should be treated as contracts when later automation depends on them.

## What

`cx` has a small set of workflows whose behavior is more than convenience. They are relied on by operators, MCP sessions, CI, and release assurance, so they should be treated as contract surfaces:

- Friday to Monday handoff
- bundle to verify to extract
- MCP read path
- safe note mutation

## Why

Architecture purity is not enough if real operator paths can drift silently. Workflow contracts keep the system usable while kernels, manifests, and plugins evolve underneath.

## How

A workflow becomes contractual when it has all of the following:

- a documented sequence
- clear failure semantics
- stable operator expectation
- tests or CI enforcement

## Rule

Do not silently change a primary workflow that downstream humans or automation already rely on.

## Links

- [[Friday To Monday Workflow Contract]]
- [[Bundle Verify Extract Workflow Contract]]
- [[MCP Read Path Contract]]
- [[Safe Note Mutation Workflow Contract]]
- `docs/modules/ROOT/pages/workflows/friday-to-monday.adoc`
- `docs/modules/ROOT/pages/workflows/safe-note-mutation.adoc`
