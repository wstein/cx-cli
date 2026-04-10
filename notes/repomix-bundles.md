# Repomix Bundles — Zettel

**Date:** 2026-04-09  
**Tags:** #repomix #cx-cli #bundle #sha256 #tooling

---

## Summary

A repomix bundle is a self-describing directory that groups one or more repomix output files (packed repository snapshots) with binary assets, a SHA-256 checksum file, and a JSON manifest.

The `cx` CLI provides five commands for bundle management:

| Command | Purpose |
|---|---|
| `cx repomix [...args]` | Forward raw arguments to the repomix CLI dependency |
| `cx bundle <path>` | Compute SHA-256s, write `manifest.json` and `SHA256SUMS`, optionally create a ZIP |
| `cx list <path>` | Show bundle contents (from `manifest.json`) or source entries inside a repomix file |
| `cx init` | Scaffold `cx.json`, `repomix.config.json`, and `.repomixignore` in the current project |
| `cx cleanup <path>` | Remove generated metadata; dry-run by default, requires `--force` to delete |

---

## Key Concepts

- **Bundle directory** — any folder containing repomix output + assets. The `cx bundle` run adds metadata in-place.
- **`SHA256SUMS`** — GNU sha256sum format; covers all data files (repomix outputs + binary assets); verified offline with `sha256sum --check`.
- **`manifest.json`** — machine-readable index: path, size, SHA-256, and semantic file type for every file in the bundle. Includes the hash of `SHA256SUMS` itself.
- **File classification** — binary extensions are detected by file extension (`.png`, `.zip`, etc.); repomix files are detected by content markers (`<repomix>`, `"files":`, `This file is a merged representation`).

---

## Architectural Notes

- Streaming SHA-256 — avoids loading large files into memory (`node:crypto` + `node:stream/promises`).
- Streaming ZIP — `archiver` package pipes files directly into the archive.
- Deterministic order — all file lists are sorted lexicographically before processing.
- No circular hashes — `SHA256SUMS` covers data files only; `manifest.json` records `SHA256SUMS` hash.
- Stale section regeneration — repomix component outputs are regenerated only when source files or config files are newer than the existing component output.
- ESM TypeScript — `"type": "module"`, `"module": "Node16"`, strict mode.

---

## Repomix Output Formats Supported by `cx list`

| Format | Detection | Notes |
|---|---|---|
| Parsable XML | Starts with `<repomix>` | Best option; fully structured |
| Handlebar XML fragment | Contains `<files>` without root | Wrapped in `<repomix>` before parsing |
| JSON | Starts with `{`, contains `"files"` | Files as `{ "path": "content" }` or array |
| Plain / Markdown | Contains repomix header text | Detected but not entry-parsable |

---

## Dependencies

| Package | Role |
|---|---|
| `repomix` | Pack repositories into single files; `mergeConfigs` for config construction |
| `fast-xml-parser` | Parse repomix XML output files into structured objects |
| `archiver` | Stream-based ZIP creation |
| `fast-glob` | Efficient directory scanning with glob patterns |
| `kleur` | Zero-dependency ANSI colour output |
| `yargs` | CLI parser and command registration |
| `yargs` | CLI parser and command registration |

---

## Workflow

```
repo/ ──[npx repomix]──▶ bundles/repomix-output.xml.txt
assets/ ──────────────▶ bundles/logo.png

bundles/ ──[cx bundle]──▶ bundles/SHA256SUMS
                        ▶ bundles/manifest.json
                        ▶ bundles/bundle.zip  (optional)
```

---

## Tooling Notes

- `bin/cx` is a Node-based shim that launches `dist/index.js`.
- The shim prefers `bun` when available, but falls back to the current Node runtime.
- It automatically rebuilds `dist/index.js` when `src/`, `package.json`, or `tsconfig.json` are newer than the existing build output.
- CI now runs runtime verification for stale-build detection and shim portability using `scripts/check-cx-rebuild.js` and `scripts/check-cx-portability.js`.
- This keeps the CLI entry point platform-neutral and avoids POSIX shell-only wrappers.

## Follow-up Ideas

- JSON Schema for `manifest.json` (schemaVersion 1).
- `cx verify <path>` — run `sha256sum --check SHA256SUMS` in-process and report mismatches.
- `cx pack <source-dir>` — shell out to `repomix`, place output in a bundle directory, then run `cx bundle` in one step.
- GitHub Actions integration — upload the ZIP as a workflow artifact.
- `cx diff <bundle-a> <bundle-b>` — diff two manifests to surface added/removed/changed files.
