---
id: 20260425120000
title: Layered Truth Model
target: current
kind: invariant
tags: [architecture, notes, docs, contract]
---

The layered truth model keeps repository cognition explicit: notes preserve intent truth, specs preserve executable rule truth, code preserves implementation truth, tests preserve behavioral truth, and docs preserve communication truth.

## What

Each layer has a distinct authority. Notes explain architectural intent and durable decisions. Specs define shared executable rules and generated contracts. Code implements the current system. Tests verify observable behavior. Docs promote stable knowledge for humans without duplicating exploratory detail.

## Why

When these layers blur, semantic drift becomes invisible. The note graph gives `cx` a way to trace claims across specs, code, tests, and docs before bundles or generated documentation reuse them.

## How

Use `cx notes check`, `cx notes graph --format json`, `cx notes trace <note-id>`, `cx notes extract`, `cx docs compile`, and `cx docs drift` to keep the layers connected.

## Links

- [[Repository Cognition Layer]]
- [[Keep Notes Separate from Antora Canonical Docs]]
- [[cx notes extract should preserve provenance into downstream docs workflows]]
