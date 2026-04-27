---
id: 20260420133000
title: Published Schema Retention Policy
tags: ["schemas", "contracts", "release"]
---
Published schemas are a latest-only public contract. Removing old schema
versions is an intentional breaking change: downstream tools must track the
current schema endpoints instead of relying on Pages as a historical archive.

## What

The repository and Pages site publish only the current schema file for each
schema family.

Examples:

- `manifest-v12.schema.json`
- `shared-handover-v2.schema.json`
- `json-section-output-v1.schema.json`

## Why

The pre-1.0 contract is allowed to break hard. Keeping old schemas made the
public Pages surface look more stable than the implementation contract and
encouraged stale pins.

## Rule

- publish only the latest schema for each family
- fail the Pages build if retired schema files are present
- treat removal of old schema endpoints as a breaking change

## Links

- [[Contract Versioning Strategy]]
- [[Top-Level JSON Payload Contracts]]
- `docs/modules/manual/pages/release-and-integrity.adoc`
