# CX Architecture

## Design Goal

`cx` exists to make context bundling reproducible enough for automation.

The project deliberately wraps Repomix in a stricter system because rendering alone is not enough for CI/CD. A pipeline also needs deterministic planning, exact metadata, verification, and explicit recovery semantics.

## Philosophy

Repomix is a strong exploratory packager.

`cx` is an operational bundler.

That distinction explains most of the architecture:

- exploratory packing tolerates heuristics
- operational bundling needs reproducibility
- local prompt assembly can accept "close enough"
- remote automation needs "provably the same"

This is why `cx` records token accounting in the manifest, writes canonical JSON, and protects emitted artifacts with SHA-256 checksums. Those are not decorative constraints. They are the mechanisms that let a bundle survive time, transport, and automation boundaries.

## System Boundary

`cx` does not shell out to Repomix. It uses a narrow adapter boundary and only relies on public exports it actually needs.

Core responsibility split:

- Repomix adapter: render section outputs
- `cx` planner: decide which files belong where
- `cx` manifest layer: describe the bundle in stable JSON
- `cx` verification layer: confirm artifacts and source-tree alignment
- `cx` extraction layer: recover files according to manifest truth

## Pipeline

### 1. Configuration load

`cx` loads `cx.toml`, expands supported paths, resolves behavioral settings, and validates the project configuration.

### 2. Deterministic planning

The planner resolves:

- project name
- source root
- output directory
- section membership
- copied assets
- unmatched files
- overlap and collision failures

This happens before rendering because the plan must be settled first.

### 3. Section rendering

Each section is rendered as one Repomix-compatible output file in the configured style:

- `xml`
- `markdown`
- `json`
- `plain`

`cx` also supplies a section-specific Repomix header through the documented `output.headerText` option so the file itself carries cx-oriented handover context without post-processing the generated output.

The renderer also reports output token counts. If the adapter supports exact span capture, `cx` records absolute `outputStartLine` and `outputEndLine` values for each packed text file.

### 4. Shared handover index

`cx bundle` writes a bundle-level index file alongside the section outputs. The index is meant to travel with the section files when multiple outputs are handed over together, so the shared context is externalized without breaking the self-contained section files.

### 4. Manifest build

`cx` writes a canonical manifest that records:

- bundle identity and versions
- source root and bundle directory
- checksum algorithm
- the shared bundle index filename
- section outputs
- copied assets
- per-file token counts
- source metadata such as size, media type, and mtime
- optional output spans

The manifest is not just a report. It is the contract other commands operate against.

### 5. Lock file and checksums

`cx bundle` also writes:

- a lock file containing the resolved Category B behavioral settings used during bundle creation
- a SHA-256 checksum sidecar covering the manifest, lock file, section outputs, and copied assets

### 6. Post-build consumers

After bundling, other commands use the recorded state:

- `validate` checks bundle structure and schema
- `verify` checks integrity and optional source-tree drift
- `list` surfaces stored metadata
- `extract` reconstructs files according to manifest semantics

## Invariants

Some failures are fundamental and intentionally hard:

- section overlap when overlap failure mode is active
- asset collision between copied assets and packed files
- missing core adapter contract

These are Category A invariants. They are never configurable away because doing so would make the bundle ambiguous or unverifiable.

## Category B Behaviors

Some operational friction points are configurable:

- overlap handling mode
- missing cx-specific adapter extension mode
- duplicate config entry mode

These are recorded in the lock file so later verification can detect drift between the settings used to build the bundle and the settings currently in effect.

## Why Persistent Token Accounting Matters

Repomix can already calculate token counts while rendering. `cx` adds a different guarantee: those counts are carried forward as part of the bundle contract instead of disappearing with a single run.

That matters in automation because later verification and downstream tooling can read the manifest's recorded token counts directly instead of re-running a render or relying on a fresh estimate in a different environment.

## Why SHA-256 Matters

Checksums are not included for cryptography theater. They prove that the artifacts the runner sees are the same artifacts the bundler emitted.

That lets `verify` detect:

- manifest tampering
- section output drift
- missing checksum entries
- copied asset mutation

For packed text rows, the manifest hash covers the normalized packed content emitted by Repomix. That keeps verification aligned with the actual handover payload instead of pretending `cx` is a source-byte archiver.

## Why Output Spans Matter

When exact span capture is available, the manifest can tell downstream tooling where each file lives in the rendered section output.

Those spans are only useful if the output remains deterministic. That is why degraded extraction is treated carefully: once the parser can no longer reconstruct the packed output cleanly, absolute coordinates can become unsafe for downstream automation.

## Extraction Semantics

`cx` classifies extraction outcomes as:

- `intact`: reconstructed text matches the packed-content hash in the manifest
- `copied`: asset restored directly from stored bundle content
- `degraded`: text is recoverable but does not match the packed-content hash in the manifest
- `blocked`: deterministic recovery is not possible from the stored output

`degraded` is intentionally not the default success path. It requires explicit operator consent with `--allow-degraded`.

See [Extraction Safety](EXTRACTION_SAFETY.md) for the operational consequences.
