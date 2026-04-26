---
id: 20260425130600
aliases: ["cx docs compile", "notes to antora"]
tags: ["cx", "docs", "antora", "generation", "stable"]
---

`cx docs compile` turns notes plus repository evidence into maintained Antora documentation surfaces.

## What

Docs should be compiled from:

- stable notes
- linked specs
- linked code
- linked tests

Profiles control whether the output targets architecture, manual, onboarding, or other surfaces.

## Why

Hand-maintained docs drift quickly. Notes already capture intent, and code/specs provide evidence. `cx` compiles those into curated docs instead of duplicating them manually.

## How

`cx docs compile --profile architecture|manual|onboarding` generates Antora-ready content with provenance markers and deterministic output.

## Links

- [[CX Semantic Drift Detection]]
- [[CX Notes Layered Source of Truth]]
