---
id: 20260409-repomix-bundles
title: Repomix Bundles in cx-cli
date: 2026-04-09
tags: [repomix, cx-cli, bundle, llm, context, manifest]
---

# Repomix Bundles in cx-cli

## Summary

`cx` adds a bundle abstraction on top of [repomix](https://github.com/yamadashy/repomix). A **bundle folder** collects one or more repomix output files (XML/JSON) alongside binary assets (images, diagrams), a `manifest.json`, and a `SHA256SUMS` file. The CLI provides four commands: `bundle`, `list`, `init`, and `cleanup`.

## Core Idea

LLM contexts often require both structured source code (repomix output) and supplementary binary assets (architecture diagrams, screenshots). A bundle folder unifies these artefacts under a deterministic manifest so they can be versioned, transferred, and verified as a unit.

## Commands

| Command | Purpose |
|---------|---------|
| `cx bundle <path>` | Scan folder, write `manifest.json` + `SHA256SUMS`; optionally zip |
| `cx list <path>` | List source files inside repomix output(s) |
| `cx init` | Scaffold `repomix.config.json` and `cx.json` |
| `cx cleanup <path>` | Remove generated artefacts |

## Implementation Notes

- **Adapter** (`src/adapters/repomixAdapter.ts`): all I/O is streaming; SHA-256 is computed via `crypto.createHash('sha256')` fed through a readable stream pipeline. No full-file buffering except for binary-sniffing (first 4 KiB only).
- **ZIP creation**: uses [archiver](https://github.com/archiverjs/node-archiver) with a streaming pipeline; entries are sorted before the archive is finalised for determinism.
- **XML parsing**: uses [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) `XMLParser` to extract `<file path="…">` nodes from repomix XML output.
- **Binary detection**: extension whitelist for common text types; otherwise sniffs the first 4096 bytes for NUL bytes.
- **Manifest idempotency**: `manifest.json` and `SHA256SUMS` are excluded from their own scan so repeated runs are stable.

## Decisions

- Bundle artefacts (`manifest.json`, `SHA256SUMS`, `*.bundle.zip`) are excluded from the scan automatically — no configuration needed.
- `cx.json` is the default config format; `cx.ts` is available via `--ts` for typed configs.
- Manifest entries and ZIP archive entries are always sorted by path (POSIX separators).
- No backwards-compatibility layer; the `cx-bundle/v1` format is the initial stable version.

## Related

- [docs/repomix-bundles.md](../docs/repomix-bundles.md) — user-facing documentation
- [src/adapters/repomixAdapter.ts](../src/adapters/repomixAdapter.ts) — adapter implementation
- [repomix repository](https://github.com/yamadashy/repomix)
