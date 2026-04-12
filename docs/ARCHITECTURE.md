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

- Repomix adapter (`src/repomix/`): render section outputs
- `cx` planner: decide which files belong where
- `cx` manifest layer: describe the bundle in stable JSON
- `cx` verification layer: confirm artifacts and source-tree alignment
- `cx` extraction layer: recover files according to manifest truth

## Adapter Boundary

The `src/repomix/` directory is the explicit adapter boundary between `cx` core
logic and the rendering backend.

- `render.ts` owns all calls into the Repomix adapter. Nothing outside this
	module invokes Repomix functions directly.
- `capabilities.ts` performs runtime feature detection (is `packStructured`
	available? is `renderWithMap` available?) so the planner and manifest builder
	never need to know which rendering path was taken.
- `handover.ts` constructs bundle-level metadata that is injected into section
	outputs without post-processing the rendered content.

The `[repomix]` section in `cx.toml` is adapter-specific configuration.
`cx.toml` keys like `show_line_numbers`, `include_empty_directories`, and
`security_check` are passed through exclusively within `render.ts` and are never
interpreted by the planner, manifest builder, or any other core module. `style`
is the single key shared between the two layers: it is used by the planner to
determine output file extensions and by `render.ts` to configure the adapter.

Future rendering backends should follow the same pattern: a new `src/<backend>/`
directory that exposes a `renderSection` function with the same signature as
`renderSectionWithRepomix`, keeping core modules unaware of adapter internals.

## Pipeline

### 1. Configuration load

`cx` loads `cx.toml`, expands supported paths, resolves behavioral settings, and validates the project configuration.

### 2. Deterministic planning

The planner resolves:

- project name
- source root
- output directory
- section membership (including priority-based overlap resolution)
- copied assets
- unmatched files
- overlap and collision failures

This happens before rendering because the plan must be settled first.

#### Section priority and overlap resolution

Sections are ordered by their `priority` value (descending) before overlap
resolution begins. A file claimed by multiple sections is assigned to whichever
section appears first in the resolved order. Sections without an explicit
priority are treated as priority 0 and their relative order follows
`dedup.order` (config position or lexical) as a stable tie-breaker.

Three overlap handling strategies are available via `dedup.mode`:

- `fail` — planning aborts with an actionable message. `cx doctor` can propose
	static `exclude` fixes, or you can set higher `priority` on the owning section
	and switch to `first-wins` to avoid static TOML mutations entirely.
- `warn` — conflicts are reported to stderr and resolution proceeds using
	priority order.
- `first-wins` — overlaps are resolved silently using priority order.

For rapidly evolving codebases where new files frequently match multiple
sections, `dedup.mode = "first-wins"` with explicit `priority` values is
preferable to accumulating static `exclude` paths in `cx.toml`. Static excludes
become stale as files are renamed or moved, and they generate merge conflicts
when multiple developers resolve overlaps concurrently on separate branches.

### 3. Section rendering

Each section is rendered as one Repomix-compatible output file in the configured style:

- `xml`
- `markdown`
- `json`
- `plain`

`cx` also supplies a section-specific Repomix header through the documented `output.headerText` option so the file itself carries cx-oriented handover context without post-processing the generated output.

The renderer also reports output token counts. If the adapter supports exact span capture, `cx` records absolute `outputStartLine` and `outputEndLine` values for each packed text file in XML, Markdown, and plain sections. Those spans are the primary lookup path for those text formats. JSON uses direct object lookup instead of span metadata, and JSON-only bundles may omit spans entirely.

### 4. Shared handover index

`cx bundle` writes a bundle-level index file alongside the section outputs. The index is meant to travel with the section files when multiple outputs are handed over together, so the shared context is externalized without breaking the self-contained section files.

### 5. Manifest build

`cx` writes a canonical manifest that records:

- bundle identity and versions
- source root and bundle directory
- checksum algorithm
- the shared bundle index filename
- section outputs
- copied assets
- per-file token counts
- source metadata such as size, media type, and mtime
- output spans for XML, Markdown, and plain sections when exact span capture is available; JSON sections do not need them

The manifest is not just a report. It is the contract other commands operate against.

### 6. Lock file and checksums

`cx bundle` also writes:

- a lock file containing the resolved Category B behavioral settings used during bundle creation
- a SHA-256 checksum sidecar covering the manifest, lock file, section outputs, and copied assets

### 7. Post-build consumers

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
