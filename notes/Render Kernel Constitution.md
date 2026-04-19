---
id: 20260420110100
title: Render Kernel Constitution
tags: ["architecture", "render", "determinism"]
status: design
---
The render kernel defines the proof-path behavior of `cx`.

## What

The kernel guarantees:

- exact output formats: xml, markdown, json, plain
- deterministic ordering
- stable normalization policy
- exact span mapping
- structured plan generation
- aggregate plan hash

## Why

All downstream trust depends on:

- reproducible outputs
- stable coordinates
- hashable content identity

If rendering changes, verification and extraction break.

## How

- kernel owns all proof-path formats
- kernel behavior is locked by tests
- kernel is not plugin-controlled

## Non-goals

- dynamic template rendering for proof-path formats
- runtime user-defined format mutation

## Links

- [[Structured Render Contract]]
- [[Bundle Sidecar Integrity]]
- [[Extraction-Safe Note Parsing]]
- `src/bundle/verify.ts`
