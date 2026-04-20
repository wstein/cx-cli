---
id: 20260420134000
title: Adapter Oracle And Reference Roles
tags: ["adapter", "migration", "contracts"]
target: current
---
cx distinguishes between an oracle adapter and a reference adapter so the migration away from Repomix-centered proof paths stays explicit and contract-tested.

## Oracle adapter

- selected at runtime
- used for adapter-oracle rendering and compatibility checks
- may be overridden with `--adapter-path`

## Reference adapter

- stable comparison target
- installed for trial lanes and migration visibility
- not implicitly selected for runtime rendering

## Why

Without explicit roles, the transition from the forked adapter to the official package becomes ambiguous and easy to misread in CI, JSON payloads, and operator tooling.

## Rule

The selected oracle and the installed reference must be surfaced separately in CLI and CI. They must not silently collapse into one unnamed adapter concept.

The selected oracle may equal the installed reference package in current CI, but
the roles remain semantically distinct and must stay separately named in
contracts and docs.

## Links

- [[Top-Level JSON Payload Contracts]]
- [[Contract Versioning Strategy]]
- [[Parity Oracle Policy]]
