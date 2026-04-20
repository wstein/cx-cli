---
id: 20260420124000
title: Contract Versioning Strategy
tags: ["contracts", "versioning", "governance"]
target: v0.4
---
Contract surfaces need explicit versioning when `cx` chooses hard breaks over deprecation layers.

## What

Semver alone is not enough for the system's most important contracts. The major contract surfaces should declare and evolve versions deliberately:

- render contract version
- manifest schema version
- plugin API version
- workflow contract version when behavior changes would break operators
- machine-readable CLI payload naming when migration metadata changes shape
- JSON artifact schemas when field semantics change for downstream consumers

## Why

If `cx` rejects compatibility shims, it must remove ambiguity somewhere else. Explicit contract versions let the system make hard changes at clean boundaries instead of relying on guesswork, stale assumptions, or accidental compatibility.

## How

Treat contract versioning as a first-class design rule:

- version the contract, not just the package
- document the owned surface for each contract
- gate breaking changes with tests and release criteria
- refuse silent behavior drift across version boundaries

Recent example:

- shared-handover JSON schema `v2` publishes the
  `recentRepositoryHistory[].message` contract explicitly after the runtime
  moved from a subject-oriented history shape to full multiline commit
  messages

## Rule

Hard breaks require explicit contract boundaries, not only a new package version.

## Links

- [[CX Constitution]]
- [[Deprecation and Removal Policy]]
- [[Release Proof Criteria]]
- `docs/SYSTEM_CONTRACTS.md`
