---
id: 20260420120300
title: Plugin Capability Tiers
tags: ["plugins", "security", "architecture"]
status: design
---
Plugins are classified by trust and capability.

## Tiers

- core: kernel-owned, proof-path
- trusted-extension: allowed in controlled environments
- experimental: non-proof, exploratory

## What

Each plugin declares:

- id
- version
- deterministic capability
- trust profile
- proof-path eligibility

## Rule

Only core plugins participate in proof path.

## Why

Unbounded plugins would break determinism.

## Links

- [[Plugin System Model]]
- [[Kernel vs Extension Boundary]]
