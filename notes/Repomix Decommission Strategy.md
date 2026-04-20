---
id: 20260420110600
title: Repomix Decommission Strategy
tags: ["repomix", "migration", "architecture"]
target: current
---
Repomix was a temporary compatibility layer during the render-kernel migration, and that decommissioning work is now closed for `v0.4`.

## What

The system transitions from:

Repomix adapter -> native render kernel

## Why

External dependency:

- increases release complexity
- weakens trust ownership
- introduces patch maintenance

## Completed phases

Phases 1-5 are complete:

1. native kernel introduced
2. parity verified via tests
3. Repomix used as oracle
4. default switched to native
5. dependency removed

## Closed state

- the native kernel owns production rendering
- the fork is no longer a shipped runtime dependency
- official `repomix` remains an optional reference oracle in parity/testing
  flows
- remaining work is messaging hardening and oracle-surface scoping, not another
  architecture flip

## Rule

Compatibility is preserved through tests, not adapter presence.

## Links

- [[Structured Render Contract]]
- [[Release Candidate on Develop]]
- `src/adapter/*`
