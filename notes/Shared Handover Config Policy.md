---
id: 20260420122500
title: Shared Handover Config Policy
tags: ["handover", "config", "policy"]
target: v0.4
---
The shared handover should have a small, explicit configuration surface so operators can bound context density without turning handover generation into an open-ended reporting system.

## What

Reasonable first controls:

- include_repo_history = true|false
- repo_history_count = 30

Optional later controls:

- repo_history_format = "subject"
- include_repo_history_body = false

## Why

The handover artifact needs bounded control, but not an open-ended configuration explosion.

## How

Configuration should remain:

- explicit
- deterministic
- small
- documented in schema and docs

## Rule

Do not turn handover generation into a general-purpose reporting DSL.

## Links

- [[Extension Config Model]]
- [[Plugin System Model]]
