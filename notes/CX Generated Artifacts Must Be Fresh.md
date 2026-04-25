---
id: 20260425130800
aliases: ["cx generated freshness", "generated drift"]
tags: ["cx", "generation", "ci", "stable"]
target: current
---

Generated note-, spec-, and doc-derived artifacts are freshness-checked build products.

## What

Generated outputs may include:

- rule contracts
- diagnostics tables
- compiled docs
- graph summaries

## Why

If generated outputs are allowed to drift silently, the repository presents contradictory states to humans, CI, and LLMs.

## How

CI runs generation commands and fails if `git diff --exit-code` reports stale artifacts.

## Links

- [[CX Semantic Drift Detection]]
- [[CX Docs Compile From Notes and Code]]
