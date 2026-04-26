---
id: 20260420124500
title: Safe Note Mutation Workflow Contract
tags: ["notes", "workflow", "contracts"]
---
Safe note mutation is a contract because cognition changes must stay reviewable and bounded.

## What

Note mutation is intentionally not the default exploratory path. It requires explicit authority, followed by graph-aware review and governance checks.

## Why

Notes influence future routing, summaries, and bundle cognition. If mutation becomes implicit or casual, the memory layer stops being durable and starts becoming ambient noise.

## How

The contract depends on these invariants:

- mutation requires explicit operator intent
- review follows mutation rather than being optional cleanup
- graph and governance checks remain part of the workflow
- notes do not gain proof status merely because they were edited

## Rule

Changing notes must remain an explicit, reviewable workflow rather than a side effect of exploration.

## Links

- [[Safe Note Mutation Workflow]]
- [[Repository Cognition Layer]]
- [[Adversarial Cognition Testing]]
- `docs/modules/manual/pages/workflows.adoc`
