---
id: 20260420121100
title: Plugin Lifecycle Policy
tags: ["plugins", "governance", "lifecycle"]
status: design
---

Plugins need a lifecycle, not just an interface, because extension systems drift when addition is easy but promotion, deprecation, and removal have no explicit review path.

## States

- proposed
- experimental
- trusted-extension
- core
- deprecated
- removed

## Rule

Promotion requires:
- stable interface
- deterministic behavior
- tests
- docs
- trust review

## Why

Lifecycle states keep temporary experiments from being mistaken for durable architecture. They also make it clear when a plugin is trusted enough to matter operationally and when it is still only exploratory.

## Links

- [[Plugin Capability Tiers]]
- [[Plugin System Model]]
