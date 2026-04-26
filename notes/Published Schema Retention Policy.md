---
id: 20260420133000
title: Published Schema Retention Policy
tags: ["schemas", "contracts", "release"]
---
Published schemas remain available on Pages as versioned artifacts throughout the pre-1.0 series so downstream tools can pin explicit contract versions.

## What

Pre-1.0 releases keep every published schema version available under its versioned Pages path.

Examples:

- `manifest-v5.schema.json`
- `manifest-v7.schema.json`
- `manifest-v8.schema.json`
- `manifest-v9.schema.json`
- `manifest-v10.schema.json`

## Why

Contract consumers need stable references while the system is still converging on its long-term owned surfaces.

## Rule

- pre-1.0: retain versioned published schemas on Pages
- `v1.0.0`: begin a new schema history baseline and retire pre-1.0 history deliberately

## Links

- [[Contract Versioning Strategy]]
- [[Top-Level JSON Payload Contracts]]
- `docs/modules/manual/pages/release-and-integrity.adoc`
