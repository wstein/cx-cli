---
id: 20260420121100
title: Plugin Lifecycle Policy
tags: ["plugins", "governance", "lifecycle"]
target: backlog
---
Plugins follow a strict lifecycle so extension systems stay governable even when new capabilities arrive quickly.

## States

- experimental
- trusted-extension
- core
- removed

## Promotion requires

- stable interface
- deterministic behavior
- tests
- documentation
- trust review

## Rule

Only core plugins participate in proof path.

## Why

Lifecycle states keep temporary experiments from being mistaken for durable architecture. They also make it clear when a plugin is trusted enough to matter operationally and when it is still only exploratory.

## Links

- [[Plugin Capability Tiers]]
- [[Plugin System Model]]
