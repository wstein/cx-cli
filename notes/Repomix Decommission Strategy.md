---
id: 20260420110600
title: Repomix Decommission Strategy
tags: ["repomix", "migration", "architecture"]
status: design
---
Repomix becomes a temporary compatibility layer.

## What

The system transitions from:

Repomix adapter -> native render kernel

## Why

External dependency:

- increases release complexity
- weakens trust ownership
- introduces patch maintenance

## How

Phases:

1. native kernel introduced
2. parity verified via tests
3. Repomix used as oracle
4. default switched to native
5. dependency removed

## Rule

Compatibility is preserved through tests, not adapter presence.

## Links

- [[Structured Render Contract]]
- [[Release Candidate on Develop]]
- `src/repomix/*`
