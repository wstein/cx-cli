---
id: 20260427100500
title: Four-Path Vocabulary Lock
aliases: ["four-path help vocabulary", "CLI path vocabulary"]
tags: ["cli", "docs", "vocabulary"]
---
The top-level CLI help and docs front door use the same four path names:

- native proof path: `bundle`, `extract`, `list`, `validate`, `verify`
- live workspace path: `mcp`
- durable cognition path: `notes`
- adapter/oracle path: `adapter`, `render`

Setup and diagnostics remain grouped separately: `init`, `inspect`, `doctor`, `audit`, `config`, `docs`, and `completion`.

This vocabulary is an operator-facing map, not a replacement for Track A/B or the CX triad. Track A/B explains trust posture; the four paths explain command choice; Run/Understand explains documentation intent.

The help snapshot is the machine guard. If the docs vocabulary changes, the CLI snapshot should change in the same PR.

## Links

- [[CX Triad]]
- [[CLI Command Lifecycle]]
- [[Operational Bifurcation]]
- [[Choose Your Operating Mode]]
