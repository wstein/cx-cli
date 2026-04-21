---
id: 20260420110200
title: Plugin System Model
tags: ["architecture", "plugins", "extensibility"]
target: backlog
---
`cx` introduces a bounded plugin system layered on top of the kernel.

## What

Plugins are categorized into families:

- scanner plugins
- tokenizer providers
- output/report plugins

The render kernel remains non-pluggable.

## Why

Extensibility is needed for:

- security scanning
- alternate token encodings
- reporting and exports

But unconstrained plugins would break determinism.

## How

Each plugin declares:

- kind
- id
- version
- deterministic capability
- trust profile
- proof-path eligibility

## Capability tiers

- core (kernel-owned)
- trusted-extension
- experimental

## Rule

Plugins may extend behavior, not redefine proof.

## Links

- [[System Trust Contract]]
- [[MCP Tool Intent Taxonomy]]
- `docs/modules/architecture/pages/system-contracts.adoc`
