---
id: 20260420130200
title: Notes Gating Policy
tags: ["notes", "governance", "quality"]
target: v0.4
---
Notes may act as optional build constraints in higher-assurance environments.

## What

Allow optional gating based on cognition quality:

```toml
[notes]
require_cognition_score = 80
strict_notes_mode = true
```

## Behavior

When enabled:

- bundle fails if required notes fall below the configured threshold
- enforcement can apply globally or to selected sections

## Why

Low-quality notes degrade AI context quality even when the rest of the proof path is structurally correct.

## Default

- disabled by default
- suitable for CI or other high-assurance pipelines

## Rule

Notes are not proof, but they may become required inputs for high-quality proof workflows.

## Links

- [[Adversarial Cognition Testing]]
- `src/notes/consistency.ts`
