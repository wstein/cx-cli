---
id: 20260420121500
title: Extension Config Model
tags: ["config", "plugins", "schema"]
target: backlog
---
Extensions must declare explicit configuration so plugin settings can remain bounded, schema-visible, and incapable of silently mutating kernel behavior.

## Required

Each extension must declare:
- namespace
- schema
- defaults
- trust profile

## Rule

Extensions must not alter kernel behavior implicitly.

## Links

- [[Plugin System Model]]
