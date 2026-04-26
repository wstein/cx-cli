---
id: 20260420121400
title: Parity Oracle Policy
tags: ["migration", "testing", "oracle"]
---
An external oracle may be used to prove migration correctness without becoming architecture, and `ci:test:render-parity` is the enforcement lane for that rule.

## What

Repomix may be used only to validate:

- output text
- spans
- hashes
- token counts
- structured plans and plan hashes when comparison fixtures require them

## Rule

The oracle proves parity; it does not define the future architecture.

## Links

- [[Native Render Migration Strategy]]
