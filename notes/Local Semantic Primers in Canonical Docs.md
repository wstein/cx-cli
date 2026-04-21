---
id: 20260420183300
title: Local Semantic Primers in Canonical Docs
aliases: []
tags: ["docs", "writing", "antora", "adoc"]
target: current
---
Antora alone will not solve the reader-treated-like-a-compiler problem. Canonical docs need short local semantic primers.

## Observation

The current docs correctly avoid redefining core semantics everywhere, but they still rely heavily on cross-references to resolve meaning. That increases cognitive load for human readers even when it improves canonical discipline.

## Rule

Each major canonical document should begin with a short local primer that includes:

- the local purpose of the document
- the minimum required meaning of Track A and Track B
- the relevant trust boundary in one or two lines
- where the reader should go next if they need the full canonical model

## Example

Instead of:

- `See MENTAL_MODEL.md`
- `See OPERATING_MODES.md`

Prefer:

- one short recap paragraph
- then the canonical cross-links

## Why this matters for AsciiDoctor

AsciiDoctor and Antora make this easier because the primer can be implemented with:

- reusable partials
- shared attributes
- in-page context sections
- admonitions and role-based blocks

That means the repo can preserve a single semantic source of truth while still giving readers just-in-time context.

Now that the curated docs live as first-class `.adoc` sources, those primers belong in the canonical Antora pages rather than in a secondary Markdown compatibility layer.

## Why this protects you

This lowers navigation cost without reintroducing uncontrolled prose duplication.

## Links

- [docs/modules/architecture/pages/mental-model.adoc](../docs/modules/architecture/pages/mental-model.adoc)
- [docs/modules/ROOT/pages/repository/docs/agent_integration.adoc](../docs/modules/ROOT/pages/repository/docs/agent_integration.adoc)
- [docs/modules/ROOT/pages/repository/docs/agent_operating_model.adoc](../docs/modules/ROOT/pages/repository/docs/agent_operating_model.adoc)
- [[Agent Operating Model]]
