---
id: 20260420120500
title: Scanner Pipeline Contract
tags: ["security", "scanner"]
status: design
---
Security scanning is a pluggable pipeline, not a renderer feature.

## What

Scanners evaluate:

- source files
- packed content
- manifests

## Output

- structured findings
- severity
- optional gating

## Rule

- core scanners may block proof
- extensions may only warn unless promoted

## Why

Security must be extensible but deterministic.

## Links

- [[Plugin Capability Tiers]]
- [[Bundle Extraction Safety Invariants]]
