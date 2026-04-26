---
id: 20260420124300
title: Bundle Verify Extract Workflow Contract
tags: ["workflow", "contracts", "bundle"]
---
The bundle to verify to extract path is a contract, not just a convenient command sequence.

## What

The operator-facing proof workflow is:

- `cx bundle`
- `cx verify`
- `cx extract`

Each step depends on the previous artifact semantics remaining stable.

## Why

This path is where rendering, manifest integrity, checksums, extraction safety, and source-tree comparison meet. If the sequence changes implicitly, later automation can accept untrustworthy artifacts or extract from unverifiable state.

## How

Keep these guarantees stable:

- bundle writes the proof artifact set
- verify proves artifact or source-tree agreement
- extract stays behind manifest and hash guardrails
- failures remain explicit and blocking when trust is lost

## Rule

Do not loosen verification or extraction guardrails to preserve convenience.

## Links

- [[Bundle Extraction Safety Invariants]]
- [[Bundle Sidecar Integrity]]
- [[Proof Path Ownership]]
- `docs/modules/manual/pages/operator-manual.adoc`
