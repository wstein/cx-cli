# CX Implementation Notes

This document describes the final implementation expectations for the repository.

## Repository Standards

- The project must build cleanly with TypeScript.
- `bun` is the primary developer workflow.
- Changes should ship with targeted tests.
- Documentation should reflect current behavior only.
- Commits should use conventional commit messages.

## Implementation Scope

- Strict TOML configuration loading and validation.
- Deterministic file discovery, section planning, and asset handling.
- Canonical JSON manifest generation with exact token metadata.
- Deterministic SHA-256 checksum generation and verification.
- Repomix-backed rendering through the adapter boundary only.
- Bundle validation, source-tree verification, and extraction with explicit degraded-mode handling over normalized packed content.
- CLI support for initialization, planning, bundling, rendering, verification, extraction, diagnostics, and overlap recovery.

## Quality Gates

- Planning must remain deterministic.
- Manifest and checksum outputs must be canonical and reproducible.
- Overlap and asset conflicts must fail loudly with actionable diagnostics.
- Adapter capability checks must distinguish core compatibility from optional span support.
- Tests must cover the shipped command surface and bundle invariants.
