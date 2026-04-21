---
id: 20260420183200
title: Documentation Surface Split for Antora
aliases: []
tags: ["docs", "antora", "information-architecture"]
target: current
---
With Antora adopted for the curated docs site and the curated pages promoted to first-class `.adoc` sources, the documentation should stay split into explicit surfaces instead of collapsing back into one large flat canonical directory with mostly human-inferred entrypoints.

## Problem

The current suite is semantically disciplined, but readers still experience too much context switching. This is not mainly a formatting problem. It is an information architecture problem.

## Proposed surfaces

Antora should separate at least these surfaces:

- **Start Here**
  - README
  - operating modes
  - quickstart and operator entrypoint

- **Manual**
  - command usage
  - configuration reference
  - practical workflows

- **Architecture**
  - mental model
  - system map
  - architecture
  - contracts
  - proof-path ownership

- **Workflows**
  - Friday to Monday
  - safe note mutation
  - release workflows

- **Release / Integrity**
  - release checklist
  - release integrity
  - coverage and assurance

- **History / Decisions**
  - selected promoted notes
  - closure notes
  - decommission notes

## Rule

A reader should not have to infer which document class they are reading.

The site structure should reveal whether a page is:

- onboarding
- reference
- architecture
- workflow
- release
- historical decision context

## Why this protects you

This reduces cognitive dependency chains without abandoning canonical ownership.

The docs can remain precise while becoming easier to traverse.

`docs/README.md` should remain the only Markdown guide in `docs/`, while the canonical hierarchy lives in the Antora component layout under `docs/antora.yml` and `docs/modules/`.

## Links

- [docs/README.md](../docs/README.md)
- [docs/modules/manual/pages/operator-manual.adoc](../docs/modules/manual/pages/operator-manual.adoc)
- [docs/modules/manual/pages/operating-modes.adoc](../docs/modules/manual/pages/operating-modes.adoc)
- [[CLI Command Lifecycle]]
