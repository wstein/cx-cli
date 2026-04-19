---
id: 20260420121600
title: Release Proof Criteria
tags: ["release", "assurance", "proof"]
status: design
---

A release is valid only if proof-path invariants still hold, because release success is not just green CI but continued evidence that rendering, manifests, extraction, and verification still mean the same thing.

## Required checks

- render parity
- manifest compatibility
- extraction compatibility
- token accounting stability
- CI and release assurance green

## Why

Architectural releases are especially risky when they improve structure but subtly drift behavior. Explicit proof criteria keep the release gate tied to invariant preservation rather than implementation confidence.

## Links

- [[Release Candidate on Develop]]
- [[Tag Finalization and Main Promotion]]
