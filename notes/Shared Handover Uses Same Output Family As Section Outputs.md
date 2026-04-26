---
id: 20260420122200
title: Shared Handover Uses Same Output Family As Section Outputs
tags: ["handover", "render", "compatibility"]
---
The shared handover artifact should use the same output family as the section outputs so the bundle stays style-consistent and the future native kernel can treat handover rendering as part of the same rendering family.

## What

If the bundle style is:

- xml -> handover is xml-compatible
- markdown -> handover is markdown-compatible
- json -> handover is json-compatible
- plain -> handover is plain-compatible

## Why

The current plain-text bundle index is an inconsistency in an otherwise style-aware bundle system.

Using the same output family improves:

- cognitive consistency
- parser reuse
- future renderer replacement
- AI handoff coherence

## How

The shared handover should be rendered by the same kernel/output machinery family, not by a special ad hoc text generator.

## Rule

The handover artifact is part of the rendering contract family, not a sidecar convenience text file.

## Links

- [[Render Kernel Constitution]]
- [[Output Extension Model]]
- [[Repomix Decommission Strategy]]
