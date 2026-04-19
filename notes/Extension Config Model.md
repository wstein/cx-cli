---
id: 20260420121500
title: Extension Config Model
tags: ["config", "plugins", "schema"]
status: design
---

Extensions require explicit config boundaries so new plugin settings can expand the system without silently changing kernel semantics, trust labels, or proof-path behavior.

## What

Each extension must declare:
- config namespace
- schema fragment
- defaults
- proof-path eligibility

## Rule

Extension config must not silently alter kernel behavior.

## Links

- [[Plugin System Model]]
- [[Internal API Stabilization]]
