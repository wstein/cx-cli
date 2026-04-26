---
id: 20260420130200
title: Notes Gating Policy
tags: ["notes", "governance", "quality"]
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
- `strict_notes_mode` requires gated notes to remain `high_signal`
- `fail_on_drift_pressured_notes` rejects gated notes with note-to-code drift pressure

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
