---
id: 20260421120600
title: cx notes extract should remain extraction not final documentation generation
aliases: [extraction not docs generation, notes extract boundary, no direct final docs from extract]
tags: [cx, notes, docs, architecture, boundaries]
target: current
---
# cx notes extract should remain extraction not final documentation generation

`cx notes extract` remains an extraction command rather than a final documentation generator because the repository needs a clean boundary between canonical knowledge compilation and downstream narrative authoring.

## What

`cx notes extract` is responsible for:
- selecting notes
- ordering notes
- packaging notes
- embedding profile and LLM contract
- emitting a deterministic structured bundle

It is not responsible for:
- writing final arc42 documents
- writing onboarding prose
- writing manual chapters
- deciding final rhetorical style

Those belong to a downstream manual synthesis and review stage outside
the first `cx` implementation boundary.

## Why

Combining extraction and final documentation generation into one command would blur authority boundaries and make the workflow harder to reason about.

A clean split keeps:
- canonical truth extraction deterministic
- narrative generation replaceable
- review points explicit
- tooling responsibilities smaller and cleaner

## How

Keep the extraction command pure and deterministic.

In `v1`, keep LLM invocation manual and keep final docs human-reviewed.
If the repository later automates synthesis, that should be introduced
as an explicit later boundary rather than folded silently into
`cx notes extract`.

Do not overload `cx notes extract` with direct document-writing behavior.

## Links

- [[cx notes extract compiles canonical notes into profile scoped LLM bundles]]
- [[Repository Cognition Layer]]
- [[Keep Notes Separate from Antora Canonical Docs]]
