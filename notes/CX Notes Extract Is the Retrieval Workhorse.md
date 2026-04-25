---
id: 20260425130500
aliases: ["cx extract", "profile extraction"]
tags: ["cx", "notes", "extraction", "stable"]
target: current
---

`cx notes extract` is the primary retrieval and bundling mechanism for note-centric workflows.

## What

It supports profiles such as:

- architecture
- onboarding
- manual
- llm
- implementation
- spec-review

and formats such as:

- xml
- markdown
- json
- plain

## Why

Different readers need different evidence cuts. A single undifferentiated note dump is inefficient for both humans and LLMs.

## How

`cx notes extract --profile ... --format ...` starts from note selection rules, expands linked evidence, preserves provenance, and emits deterministic bundles.

## Links

- [[CX Notes Ask Needs Evidence Bundles]]
- [[CX Docs Compile From Notes and Code]]
- [[CX Semantic Drift Detection]]
