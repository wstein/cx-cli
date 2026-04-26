---
id: 20260420121200
title: Deprecation and Removal Policy
tags: ["governance", "deprecation"]
---
`cx` does not use deprecation layers while it remains pre-public, because compatibility shims and dual behavior paths weaken contracts faster than they help migration.

## What

Breaking changes are introduced directly at version boundaries.

## Rule

- no compatibility shims
- no dual behavior paths
- contracts change explicitly

## Constraint

This policy applies while `cx` is pre-public.

## Why

Deprecation layers create hidden complexity, expand the test surface, and make proof-path ownership ambiguous. If `cx` avoids them, it must instead rely on explicit contracts, version boundaries, and migration-proof tests.

## Links

- [[CX Constitution]]
