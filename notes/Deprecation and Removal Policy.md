---
id: 20260420121200
title: Deprecation and Removal Policy
tags: ["governance", "deprecation"]
status: current
---

Deprecated paths must have explicit removal intent so temporary compatibility language, adapter fallbacks, and migration scaffolding do not harden into permanent architecture by inertia.

## What

A deprecated feature must declare:
- why it is deprecated
- replacement path
- removal target
- compatibility expectation

## Rule

Temporary compatibility must not become permanent architecture.

## Why

Deprecation without removal intent creates false stability. The repository then keeps paying complexity costs for paths that no longer represent the desired proof model.

## Links

- [[Repomix Decommission Strategy]]
- [[CX Constitution]]
