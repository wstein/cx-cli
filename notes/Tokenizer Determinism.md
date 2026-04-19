---
id: 20260420120600
title: Tokenizer Determinism
tags: ["tokens", "determinism"]
target: v0.4
---
Token counting is part of the proof contract.

## What

- token encoding must be declared
- token counts must be deterministic
- manifest must record encoding

## Why

Agents depend on token size for reasoning and cost.

## Rule

Tokenization must not vary across runs.

## Future

Tokenizer providers may be pluggable, but must remain deterministic.

## Links

- [[Token Accounting]]
- [[Plugin System Model]]
