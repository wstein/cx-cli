---
id: 20260420120700
title: Adversarial Cognition Testing
tags: ["testing", "notes", "quality"]
---
The system must be resilient to bad knowledge.

## Test cases

- contradictory notes
- outdated notes
- irrelevant notes
- misleading summaries

## What

The system must:

- detect contradictions
- flag staleness
- preserve signal quality

## Why

Notes are conditional truth, not guaranteed truth.

## Links

- [[Repository Cognition Layer]]
- [[System Trust Contract]]
- `src/notes/consistency.ts`
- `src/notes/contradictions.ts`
