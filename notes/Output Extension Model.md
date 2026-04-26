---
id: 20260420110500
title: Output Extension Model
tags: ["output", "templates", "plugins"]
---
Non-proof outputs may be generated via extension plugins.

## What

Output plugins can produce:

- reports
- dashboards
- alternate exports
- UI-friendly formats

## Why

Proof formats must remain stable.

But operators need flexible views.

## How

- output plugins consume structured plan + manifest
- they do not affect proof artifacts
- they may use template systems (e.g. Handlebars)

## Rule

Output plugins must not modify:

- section outputs
- spans
- hashes
- manifest core fields

## Links

- [[Structured Render Contract]]
- `docs/modules/architecture/pages/system-map.adoc`
- `src/templates/engine.ts`
