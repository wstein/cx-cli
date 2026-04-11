# CX Task Summary

This repository implements `cx` as a production-focused TypeScript CLI built with `bun`, `yargs`, and the public Repomix package API.

## Commands

The current command set is:

- `cx init`
- `cx inspect`
- `cx bundle`
- `cx doctor`
- `cx extract`
- `cx list`
- `cx render`
- `cx validate`
- `cx verify`
- `cx adapter <capabilities|inspect|doctor>`

## Code Areas

- `src/config/` loads strict TOML configuration, applies defaults, resolves templates, validates list display thresholds, and supports configurable exact token counting plus a manifest-stored grayscale time palette for `cx list`.
- `src/planning/` builds a deterministic bundle plan with overlap detection, asset conflict detection, lexical output ordering, source modification-time capture for every planned file, and shared diagnostics that drive `cx doctor overlaps` and `cx doctor fix-overlaps`.
- `src/repomix/` keeps rendering behind a narrow adapter that uses public Repomix exports instead of subprocess calls or deep private imports, checks adapter compatibility through those exports rather than package-layout assumptions, and falls back cleanly when exact span capture is unavailable.
- `src/extract/` restores XML, JSON, Markdown, and Plain bundles according to explicit status semantics, requires `--allow-degraded` for non-exact text recovery, and emits structured extract failure payloads that identify blocked or degraded files precisely.
- `src/manifest/` writes a canonical JSON manifest plus a lexical SHA-256 sidecar. Each section stores its file metadata as a standard array of objects, keeping the format straightforward for downstream consumers. Source modification time, exact token counts, tokenizer encoding, and list display settings are included so bundle consumers can operate from manifest data alone.
- `src/bundle/` validates and verifies emitted bundles independently of the original config file, rejects ambiguous manifest sets, proves checksum completeness, and can compare a bundle directly against a source tree with `verify --against`.
- `src/cli/` exposes the workflow through `yargs`, now behaves cleanly at the top level with global help and version output, restores manifest-recorded source times during extraction, renders `cx list` in section-grouped form with per-file status, exposes bundle-side file status in both human and JSON `inspect` output when a matching bundle is present, and provides doctor flows for overlap diagnosis and guided recovery.
- `src/shared/manifestSummary.ts` provides stable manifest-derived summaries so `list`, `extract`, and `validate` can expose consistent machine-readable counts and selections.
- `scripts/repomix-version-smoke.ts` provides a CI smoke path for the active Repomix adapter contract.

## Final Decisions

- `cx` remains a separate package layered on top of Repomix.
- Section overlap fails by default.
- Assets are copied raw, not embedded into text outputs.
- The JSON manifest is authoritative for bundle structure.
- Checksums are lexical and deterministic.
- Exact output spans are optional and are emitted only when the adapter can capture them precisely.
- Exact token counts are stored in the manifest and use tokenizer encodings instead of heuristics.
