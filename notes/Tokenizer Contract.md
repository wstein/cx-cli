---
id: 20260420110400
title: Tokenizer Contract
tags: ["tokens", "determinism", "manifest"]
target: current
---
Token accounting is part of the deterministic contract.

## What

Each bundle records:

- token encoding
- per-file token counts
- section token totals

## Why

Token counts affect:

- LLM routing
- cost estimation
- reproducibility of agent behavior

## How

- tokenizer identity is stored in manifest
- tokenization must be deterministic
- providers must produce stable outputs

## Extension model

Tokenizer providers can be added, but:

- must declare encoding
- must be deterministic
- must be included in manifest

## Links

- [[Token Accounting]]
- `docs/config-reference.md`
- `src/shared/tokens.ts`
