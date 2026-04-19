---
id: 20260420121400
title: Parity Oracle Policy
tags: ["migration", "testing", "oracle"]
status: design
---

A temporary oracle may be used during migration without becoming architecture if its role stays narrow, measurable, and explicitly subordinate to the future kernel-owned proof path.

## What

The legacy renderer may be used only to compare:
- output text
- spans
- token counts
- plan hashes

## Rule

The oracle proves parity; it does not define the future architecture.

## Why

Oracle use is valuable during migration because it catches hidden drift, but it becomes architectural debt if later contributors start treating the comparison target as the real owner of proof semantics.

## Links

- [[Native Render Migration Strategy]]
- [[Repomix Decommission Strategy]]
