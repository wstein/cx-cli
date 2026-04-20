---
id: 20260420183000
title: Antora and AsciiDoctor Adoption Boundary
aliases: []
tags: ["docs", "antora", "asciidoctor", "architecture"]
target: v0.4
---
Antora and AsciiDoctor should be adopted for the curated documentation surface, not for every text artifact in the repository.

## Why

The current documentation already behaves like a governed doc system with canonical entrypoints, cross-references, contracts, workflows, and release-oriented reference material. That kind of corpus benefits from versioned navigation, reusable partials, attributes, cross-page xrefs, and stronger long-form formatting than plain Markdown provides.

The current docs also still force readers to traverse multiple files before they can continue the page they started with. Antora can improve navigability and reduce that friction, but only for the curated docs surface.

## Boundary

Adopt Antora and AsciiDoctor for:

- canonical docs
- operator manuals
- architecture reference
- workflow reference
- release and integrity docs
- configuration reference
- selected decision records if promoted intentionally

Do not automatically migrate:

- the entire `notes/` graph
- generated artifacts
- bundle handover outputs
- ad hoc planning notes
- raw repository knowledge capture

## Why this protects you

A selective boundary avoids turning the documentation migration into a format war.

The goal is not to upgrade all prose. The goal is to improve the information architecture of the official docs without flattening the distinction between curated documentation and durable cognition notes.

## Links

- [README.md](../README.md)
- [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
- [docs/MANUAL.md](../docs/MANUAL.md)
- [[Repository Cognition Layer]]
