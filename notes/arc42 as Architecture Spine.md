---
id: 20260420183100
title: arc42 as Architecture Spine
aliases: []
tags: ["docs", "arc42", "architecture", "adoc"]
target: current
---
arc42 fits the architecture and contract layer of `cx` well, but it should be used as the spine of the curated architecture corpus rather than as the structure for the whole repository.

## Why

The current repository already contains the ingredients of an arc42-style architecture set:

- system goals and framing
- constraints and trust boundaries
- architecture and system map
- runtime workflows
- internal API contracts
- release integrity and quality requirements
- decision-style notes and closure notes

This means arc42 can provide stronger structure without forcing a reinvention of the content itself.

## Recommended mapping

Possible mapping:

- Introduction and Goals -> `docs/README.md`, `docs/modules/ROOT/pages/architecture/mental-model.adoc`
- Constraints -> `docs/modules/ROOT/pages/architecture/system-contracts.adoc`
- Context and Scope -> `docs/modules/ROOT/pages/architecture/system-map.adoc`
- Solution Strategy -> `docs/modules/ROOT/pages/manual/operating-modes.adoc`
- Building Block View -> `docs/modules/ROOT/pages/architecture/implementation-reference.adoc`
- Runtime View -> workflow docs
- Deployment View -> CI and release docs
- Cross-cutting Concepts -> trust model, notes model, scanner model
- Decisions -> promoted architecture notes
- Quality Requirements -> determinism, reproducibility, extraction safety
- Risks and Technical Debt -> mutation policy, degraded extraction, scanner growth
- Glossary -> Track A, Track B, proof path, oracle, shared handover

## Non-goal

arc42 should not become the container for the notes graph.

The notes layer is intentionally more atomic, more historical, and more exploratory than the canonical architecture surface.

## Why this protects you

Using arc42 only for the architecture spine keeps the repository from over-normalizing all knowledge into one template while still giving the official docs a stronger architectural skeleton.

## Links

- [arc42 template](https://arc42.org/)
- [arc42 template EN with help](https://github.com/arc42/arc42-template/raw/master/dist/arc42-template-EN-withhelp-asciidoc.zip)
- [docs/modules/ROOT/pages/architecture/implementation-reference.adoc](../docs/modules/ROOT/pages/architecture/implementation-reference.adoc)
- [docs/modules/ROOT/pages/architecture/system-map.adoc](../docs/modules/ROOT/pages/architecture/system-map.adoc)
- [docs/modules/ROOT/pages/architecture/system-contracts.adoc](../docs/modules/ROOT/pages/architecture/system-contracts.adoc)
- [[Render Kernel Constitution]]
