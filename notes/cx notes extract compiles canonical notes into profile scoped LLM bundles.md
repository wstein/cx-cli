---
id: 20260421120000
title: cx notes extract compiles canonical notes into profile scoped LLM bundles
aliases: [cx notes extract, notes extraction command, profile scoped notes bundle]
tags: [cx, notes, extraction, llm, cli]
target: v0.4
---
# cx notes extract compiles canonical notes into profile scoped LLM bundles

`cx notes extract` should compile canonical notes into profile-scoped LLM bundles because the repository needs a deterministic bridge between atomic note truth and downstream narrative documentation workflows without making generated docs or LLM prompts the new source of truth.

## What

The command `cx notes extract` would read canonical notes from `notes/**`, apply profile-specific selection and ordering rules, and emit a structured bundle for downstream LLM-assisted document compilation.

The command should not write final human docs directly.

Instead it should produce a profile-shaped extraction artifact containing:
- canonical note content
- profile metadata
- authoring contract
- output target hints
- provenance
- deterministic ordering

This makes the command a compiler from notes into LLM input bundles rather than a docs generator.

## Why

Atomic notes are excellent as canonical truth, but they are not ideal as direct human-facing documentation or as raw prompt input.

The repository needs an intermediate artifact that is:
- deterministic
- machine-friendly
- profile-aware
- explicit about authority boundaries

This would allow:
- notes to remain canonical
- LLM synthesis to stay constrained
- generated docs to remain downstream and reviewable
- different document products to consume the same truth base safely

## How

Implement `cx notes extract` as a read-only extraction command.

It should:
- load validated notes
- select notes by profile rules
- preserve authored content and metadata
- emit ordered structured output for LLM consumption
- include profile-level instructions in the output bundle

It must not:
- invent new architectural meaning
- summarize notes into new canonical facts
- write production docs directly
- replace manual review of generated docs

## Links

- [[Repository Cognition Layer]]
- [[Keep Notes Separate from Antora Canonical Docs]]
- [[Contract Versioning Strategy]]
- [notes/README.md](README.md)
- [cx.toml](../cx.toml)
