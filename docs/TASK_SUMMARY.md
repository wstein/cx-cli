# CX Task Summary

This repository implements `cx` as a production-focused TypeScript CLI built
with `bun`, `yargs`, and the public Repomix package API.

The current documentation work is centered on [docs/README.md](./README.md)
and [docs/spec-draft.md](./spec-draft.md). Those files now define the main
editorial contract for the rest of the docs set.

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

- `src/config/` loads strict project TOML configuration, resolves templates, supports configurable exact token counting, and loads user-level `cx list` display preferences from `~/.config/cx/cx.toml` or `$XDG_CONFIG_HOME/cx/cx.toml`.
- `src/planning/` builds a deterministic bundle plan with overlap detection, asset conflict detection, lexical output ordering, source modification-time capture for every planned file, and shared diagnostics that drive `cx doctor overlaps` and `cx doctor fix-overlaps`.
- `src/repomix/` keeps rendering behind a narrow adapter that uses public Repomix exports instead of subprocess calls or deep private imports, checks adapter compatibility through those exports rather than package-layout assumptions, and only permits bundles without text spans when the output is JSON-only.
- `src/extract/` restores XML, Markdown, and Plain bundles by slicing manifest-recorded output spans, handles JSON bundles by direct object lookup, requires `--allow-degraded` for deterministic fallback recovery, and emits structured extract failure payloads that identify blocked or degraded files precisely.
- `src/manifest/` writes a canonical JSON manifest plus a lexical SHA-256 sidecar. Each section stores its file metadata as a standard array of objects, keeping the format straightforward for downstream consumers. Source modification time, exact token counts, tokenizer encoding, and the normalized packed-content hash are included without bundling user-specific display preferences.
- `src/bundle/` validates and verifies emitted bundles independently of the original config file, rejects ambiguous manifest sets, proves checksum completeness, and can compare a bundle directly against a source tree with `verify --against` by re-rendering the selected files through the Repomix adapter.
- `src/cli/` exposes the workflow through `yargs`, now behaves cleanly at the top level with global help and version output, restores manifest-recorded source times during extraction, renders `cx list` in section-grouped form with per-file status, exposes bundle-side file status in both human and JSON `inspect` output when a matching bundle is present, and provides doctor flows for overlap diagnosis and guided recovery.
- `src/shared/manifestSummary.ts` provides stable manifest-derived summaries so `list`, `extract`, and `validate` can expose consistent machine-readable counts and selections.
- `scripts/repomix-version-smoke.ts` provides a CI smoke path for the active Repomix adapter contract.

## Final Decisions

- `cx` remains a separate package layered on top of Repomix.
- Section overlap fails by default.
- Assets are copied raw, not embedded into text outputs.
- The JSON manifest is authoritative for bundle structure.
- Checksums are lexical and deterministic.
- Exact output spans are required for text bundles, recorded when the adapter can capture them precisely, and are the primary lookup path for extraction. JSON-only bundles may omit them.
- Exact token counts are stored in the manifest and use tokenizer encodings instead of heuristics.
- `cx list` heat-map thresholds and grayscale palette are user preferences and do not belong in project config or manifest data.
- Documentation should treat the spec draft as the source of truth and keep
  supporting docs pointed back to the index.
