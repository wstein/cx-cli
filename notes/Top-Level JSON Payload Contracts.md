---
id: 20260420124600
title: Top-Level JSON Payload Contracts
tags: ["contracts", "json", "release"]
target: current
---
Top-level machine-readable JSON fields are versioned contract surfaces.

## What

The top-level shape of a CLI JSON payload is part of the owned contract:

- field names
- payload nesting
- presence or absence of migration metadata

## Why

Operators, CI jobs, and downstream tooling bind to these fields directly. Silent renames or metadata drift create breakage that is hard to detect until automation fails in production.

## How

When a top-level JSON field changes:

- treat it as a deliberate contract change
- update migration docs
- update contract tests
- gate the change in release assurance

## Rule

Top-level JSON payload names must never drift silently.

## Links

- [[Contract Versioning Strategy]]
- [[Release Proof Criteria]]
- `tests/contracts/adapterCapabilities.contract.test.ts`
