---
id: 20260421120500
title: cx notes extract should preserve provenance into downstream docs workflows
aliases: [extraction provenance, provenance preserving notes bundles, note source traceability]
tags: [cx, notes, provenance, docs, governance]
target: v0.4
---
# cx notes extract should preserve provenance into downstream docs workflows

`cx notes extract` should preserve provenance into downstream documentation workflows because generated or LLM-compiled docs remain trustworthy only when reviewers can trace claims back to the canonical notes that supplied them.

## What

An extraction bundle should preserve provenance such as:
- note path
- note id
- note title
- tags
- source ordering
- profile name
- generation command
- generation timestamp or build metadata if desired

This provenance should survive into downstream reviewable artifacts wherever practical.

## Why

Without provenance, the LLM synthesis step becomes a trust gap.

Reviewers need to know:
- where statements came from
- which notes were in scope
- whether important notes were excluded
- which profile shaped the extraction

Provenance makes the workflow auditable and reduces the risk of narrative drift.

## How

Emit provenance in the extraction bundle as explicit metadata blocks.

Encourage downstream docs compilation to keep at least a compact provenance header or comment block listing:
- selected profile
- source notes
- generation command

Do not force reviewers to reconstruct the note set indirectly from commit history.

## Links

- [[cx notes extract compiles canonical notes into profile scoped LLM bundles]]
- [[Repository Cognition Layer]]
- [[Proof Path Ownership]]
