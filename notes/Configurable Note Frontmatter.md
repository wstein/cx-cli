---
id: 20260424120000
aliases: ["configurable frontmatter validation"]
tags: ["notes", "config", "validation"]
---

Note frontmatter validation should keep repository-wide structural invariants while letting each project define its own routing vocabulary.

## What

`cx` validates timestamp note ids and required structural fields by default, but target labels and other frontmatter value sets are project policy. Projects can constrain fields through `[notes.frontmatter.fields.<name>]` in `cx.toml`.

## Why

Hardcoded release-line targets made one repository's lifecycle vocabulary leak into every workspace. Open defaults avoid false validation failures while preserving a configurable enforcement path for teams that want stricter labels.

## How

Use exact values, wildcard patterns, or regex literals in frontmatter field rules when a project needs controlled values. Keep value lists empty when the field should accept any non-empty string or string-array entry.

## Links

- [[Frontmatter Validation and Duplicate ID Guard]]
- [[Safe Note Mutation Workflow]]
- [[src/notes/validate.ts]]
- [[src/config/load.ts]]
