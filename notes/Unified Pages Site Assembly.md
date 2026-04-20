---
id: 20260419151500
title: Unified Pages Site Assembly
aliases: []
tags: [docs, ci, release]
target: current
---
The public Pages publish should assemble one coherent `dist/site/` tree instead of letting schema publishing and coverage publishing behave like competing deployers. The shared tree now owns the root index, `/schemas/`, and the optional `/coverage/` subtree so later workflow changes can decide when to publish without re-implementing site structure.

This matters because publishing logic and site structure are different contracts. A reusable assembler keeps the staged output deterministic, testable, and easy to reason about before the workflow decides whether a given CI run is eligible to publish.

How to apply it:

- build Pages content through the shared assembly script, not inline workflow shell
- treat `/schemas/` as required and `/coverage/` as conditional on coverage assets being present
- keep the public root page responsible for linking the available surfaces
- validate the staged `dist/site/` tree with a smoke checker before any workflow pushes `gh-pages`

## Links

- [.github/workflows/publish-schemas.yml](../.github/workflows/publish-schemas.yml)
- [scripts/assemble-pages-site.js](../scripts/assemble-pages-site.js)
- [scripts/check-pages-site.js](../scripts/check-pages-site.js)
- [docs/modules/ROOT/pages/release/checklist.adoc](../docs/modules/ROOT/pages/release/checklist.adoc)
- [[GitHub Actions Triggers]]
- [[Pages Smoke Validation Workflow]]
- [[MCP Stable Contract Boundary]]
