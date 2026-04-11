# CX Architecture Notes

This document records the final architectural decisions that define `cx`.

## Core Decisions

- `cx` is a separate package layered on top of Repomix.
- Repomix integration is constrained behind a narrow adapter that uses public exports only.
- Core adapter compatibility requires `mergeConfigs` plus at least one rendering path: `packStructured()` or `pack()`.
- Exact output spans are optional metadata and are emitted only when the adapter provides exact span capture.
- Section overlap fails by default and must be resolved explicitly.
- Assets are copied as raw files and are not embedded into section text outputs.
- The manifest is authoritative and uses canonical JSON with standard object arrays for section file metadata.
- Exact token counts are stored in the manifest and are based on tokenizer encodings, not heuristics.
- Checksums are deterministic and must cover every emitted bundle artifact.

## Operational Rules

- The implementation does not shell out to Repomix.
- Planning, manifest generation, validation, and verification must remain deterministic.
- Missing optional span capability degrades with an explicit warning, not a hard failure.
- Real planning conflicts such as section overlap and asset collisions remain hard failures.
- Extraction restores exact files by default and requires explicit opt-in for degraded recovery.

## Tooling Rules

- `bun` is the primary development workflow and lockfile owner.
- Commits use conventional commit messages.
- Documentation should describe shipped behavior only.
- Tests should cover deterministic planning, adapter compatibility, manifest integrity, and extraction semantics.
