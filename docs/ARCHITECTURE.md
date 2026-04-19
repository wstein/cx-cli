<!-- Source: ARCHITECTURE.md | Status: CANONICAL | Stability: STABLE -->

# CX Architecture

This is the implementation reference for contributors who need to understand how
the codebase enforces the canonical model.

Read this after [MENTAL_MODEL.md](MENTAL_MODEL.md),
[SYSTEM_CONTRACTS.md](SYSTEM_CONTRACTS.md), and [SYSTEM_MAP.md](SYSTEM_MAP.md),
not before them.

## Design Goal

`cx` exists to make context bundling reproducible enough for automation.

For the documentation map, see [README.md](README.md).

The project deliberately wraps Repomix in a stricter system because rendering alone is not enough for CI/CD. A pipeline also needs deterministic planning, exact metadata, verification, and explicit recovery semantics.

## Canonical Model

See: [OPERATING_MODES.md](OPERATING_MODES.md)
See: [MENTAL_MODEL.md](MENTAL_MODEL.md)

This document starts where the shared mental model stops. The mental model defines the CX triad, Track A vs Track B, MCP policy tiers, and the artifact lifecycle. Architecture explains how the codebase enforces that model with deterministic planning, manifest truth, verification rules, and extraction guardrails.

## Philosophy

Repomix is a strong exploratory packager.

`cx` is an operational bundler.

That distinction explains most of the architecture:

- exploratory packing tolerates heuristics
- operational bundling needs reproducibility
- local prompt assembly can accept "close enough"
- remote automation needs "provably the same"

This is why `cx` records token accounting in the manifest, writes canonical JSON, and protects emitted artifacts with SHA-256 checksums. Those are not decorative constraints. They are the mechanisms that let a bundle survive time, transport, and automation boundaries.

## Current Implementation Priorities

The current reliability program avoids broad framework churn and instead
prioritizes boundary cleanup and clearer ownership.

The active modernization targets are:

- keeping command I/O injectable instead of process-global
- keeping workspace context explicit instead of ambient
- keeping Vitest as the authoritative shared-suite test runner and coverage lane
- keeping Bun limited to explicit runtime compatibility smoke
- preserving the in-process Repomix fork boundary as a narrow adapter layer

That means the main architectural work is still about deterministic boundaries,
not about swapping frameworks for their own sake.

## System Boundary

`cx` does not shell out to Repomix. It uses a narrow adapter boundary and only relies on public exports it actually needs.

Core responsibility split:

- Repomix adapter (`src/repomix/`): render section outputs
- `cx` planner: decide which files belong where
- `cx` manifest layer: describe the bundle in stable JSON
- `cx` verification layer: confirm artifacts and source-tree alignment
- `cx` extraction layer: recover files according to manifest truth

## Structured Render Contract (Phase 1)

Starting with v0.3.17, `cx` enforces a **deterministic structured render contract** instead of heuristic span parsing.

### The Problem

Previous versions computed file spans by parsing rendered output markers (XML tags, Markdown headings, plain-text delimiters). This approach suffered from:
- Marker-based heuristics that could fail silently on rendering variations
- Span calculations dependent on indirect inference
- No cryptographic verification of render plan integrity

### The Solution

**Structured truth at render time:** The repomix adapter now provides `packStructured()`, which returns:

```ts
interface StructuredRenderEntry {
  path: string;
  content: string;
  sha256: string;        // Content hash, not dependent on rendering
  tokenCount: number;
}

interface StructuredRenderPlan {
  entries: StructuredRenderEntry[];
  ordering: string[];    // Canonical lexicographic ordering
}
```

### Enforcement

1. **Deterministic ordering**: All files are sorted lexicographically. `validatePlanOrdering()` enforces this invariant.

2. **Content integrity**: Each file's sha256 is computed during structured extraction, not after rendering. `validateEntryHashes()` verifies consistency.

3. **Plan hash**: The manifest stores `renderPlanHash`, computed from the deterministic JSON representation of the plan. This provides cryptographic proof that the render plan is correct.

4. **Verification**: `cx verify` now checks:
   - Ordering is deterministic (no regressions in file order)
   - All entry hashes are consistent (content didn't drift)
   - Plan hash is reproducible (render contract is sound)

### Files

- `src/repomix/structured.ts`: Core types and utilities
- `src/repomix/render.ts`: Updated to extract and return structured plans
- `src/manifest/types.ts`: Added `renderPlanHash` field
- `src/manifest/build.ts`: Computes aggregate plan hash from sections
- `src/bundle/verify.ts`: Validates plan integrity during verification

## Module Layer Rules

The codebase enforces strict import directionality. Violations are bugs, not
style issues.

```text
config/  shared/  vcs/           ← foundation (no domain imports)
    ↓
notes/   planning/  manifest/    ← domain modules
    ↓
inspect/  doctor/   repomix/     ← cross-domain orchestration
    ↓
mcp/                             ← transport layer (imports domain only)
    ↓
cli/commands/                    ← presentation layer (thin shells)
```

**Enforced boundaries:**

- `planning/` must not import from `notes/`. The planner classifies files; note
  graph enrichment is an orchestration concern. `notes/planner.ts` provides
  `enrichPlanWithLinkedNotes` as a post-planning step called by the CLI bundle
  and inspect paths, not by the planner itself.

- `mcp/` must not import from `cli/commands/`. MCP is a transport layer; it
  imports domain functions from `doctor/`, `inspect/`, `notes/`, and
  `planning/` directly. The CLI command files are thin presentation shells that
  re-export from those same domain modules.

- Note CRUD operations (`createNewNote`, `readNote`, `updateNote`, `renameNote`,
  `deleteNote`, `searchNotes`, `listNotes`) live in `notes/crud.ts`, not in
  `cli/commands/`. CLI and MCP both import from the domain module.

- MCP config resolution (`resolveMcpConfigPath`) lives in `mcp/config.ts`, not
  in `cli/commands/`. The CLI mcp command re-exports it from there.

**Module inventory (domain layer):**

| Module | Responsibility |
|--------|---------------|
| `notes/crud.ts` | Note CRUD I/O and search |
| `notes/graph.ts` | Note link graph construction and queries |
| `notes/planner.ts` | Linked-note enrichment for bundle plans |
| `planning/masterList.ts` | VCS-anchored master file list construction |
| `doctor/mcp.ts` | MCP profile diagnostic report |
| `doctor/overlaps.ts` | Section overlap diagnostic report |
| `doctor/secrets.ts` | Secret scan diagnostic report |
| `doctor/workflow.ts` | Workflow mode recommendation |
| `inspect/report.ts` | Bundle plan inspection report |
| `mcp/config.ts` | MCP config path resolution |
| `mcp/tools/catalog.ts` | Shared MCP tool catalog and capability metadata |
| `mcp/tools/register.ts` | Shared MCP registration wrapper that carries capability into enforcement |
| `mcp/tools/workspace.ts` | Workspace navigation tools |
| `mcp/tools/bundle.ts` | Bundle preview and inspect tools |
| `mcp/tools/doctor.ts` | Doctor diagnostic tools |
| `mcp/tools/notes.ts` | Note CRUD and graph tools |

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

Planning is a three-phase pipeline anchored to the VCS-derived master list.

#### Phase 1: Build the master base

The planner resolves the source of truth for candidate files from version
control, not from a broad filesystem walk. The priority order is:

1. **Git** — `git ls-files --cached` provides the tracked set.
2. **Fossil** — `fossil ls` provides the tracked set.
3. **Filesystem** — used as a fallback when no VCS root is detected (for test
 environments or unversioned workspaces).

That VCS-derived list is the master base for all later planning decisions.

> Tests validate VCS dispatch using real temporary repositories rather than module mocking.
> This avoids worker-global mock leakage and keeps the planner behavior identical to the actual
> Git/Fossil/Hg provider code paths used in production.

#### Phase 2: Apply global list shaping

The global `[files] include` array can extend the master base with extra paths
that the VCS does not track, such as generated artefacts or build outputs.
The global `[files] exclude` array is applied after all extensions to remove
paths that should never be planned.

This shaping step changes membership in the master base, but it still does not
let sections discover new files on their own.

#### Phase 3: Classify into sections

Section `include` and `exclude` globs are **classifiers**, not discoverers.
They operate only on the already-computed master base and can never add a file
that is not already in it. This separates the question of *what exists* from
the question of *where it belongs*.

At this stage the planner resolves:

- project name
- source root
- output directory
- VCS provider and working-tree dirty state
- section membership (including priority-based overlap resolution)
- copied assets
- unmatched files
- overlap and collision failures

This happens before rendering because the plan must be settled first.

#### Dirty state taxonomy

After deriving the master list, the planner classifies the working tree into
one of four states:

| State | Condition | Default behavior |
|---|---|---|
| `clean` | No modified or untracked files | Plan proceeds normally |
| `safe_dirty` | Only untracked files present | Plan proceeds with a warning |
| `unsafe_dirty` | Tracked files have uncommitted modifications | Planning aborts (exit 7) |
| `forced_dirty` | `unsafe_dirty` overridden with `--force` | Plan proceeds with a warning |
| `ci_dirty` | `unsafe_dirty` overridden with `--ci` | Plan proceeds with a warning |

The `unsafe_dirty` guard exists because a bundle built from a dirty tracked
file cannot be reliably reproduced or verified later. Two escape hatches are
available: `--force` for local experimentation where a human is present, and
`--ci` for automated pipelines. Both are recorded in the manifest under
distinct state labels so audit tooling can distinguish human overrides from
pipeline overrides.

Why this protects you: a tracked-file bundle built from a moving working tree cannot later prove what source state it represents. Refusing to proceed by default keeps the artifact contract anchored to reproducible input.

VCS state is not tracked for filesystem-fallback workspaces. Those always
produce `dirtyState = "clean"` and `vcsProvider = "none"`.

#### Section priority and overlap resolution

Sections are ordered by their `priority` value (descending) before overlap
resolution begins. A file claimed by multiple sections is assigned to whichever
section appears first in the resolved order. Sections without an explicit
priority are treated as priority 0 and their relative order follows
`dedup.order` (config position or lexical) as a stable tie-breaker.

#### Catch-all sections

A section may set `catch_all = true` instead of providing an `include` list.
A catch-all section absorbs all files in the master list that were not claimed
by any other section. It runs last in the planning pipeline, after all
normal sections have consumed their files, and may still apply an `exclude`
list to filter what it absorbs.

At most one catch-all section is permitted per configuration.

This same mechanism lets repository notes live in the normal planning model.
The default `docs` section now includes `notes/**`, so durable human intent is
bundled beside documentation and code-facing Markdown instead of being treated
as a separate side channel.

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
That header is intentionally a presentation-layer prolog rather than part of the core format semantics: it explains what the artifact is, how to interpret logical paths, where edits belong, and which bundle contracts remain authoritative.

This yields more semantic fluency for humans and AI consumers without relaxing the deterministic contract:

- rigid core semantics for markers, directives, manifests, and validation
- expressive consumer guidance in the generated prolog and bundle index
- optional narrative cues that never override canonical bundle data

The renderer also reports output token counts. If the adapter supports exact span capture, `cx` records absolute `outputStartLine` and `outputEndLine` values for each packed text file in XML, Markdown, and plain sections. Those spans are the primary lookup path for those text formats. JSON uses direct object lookup instead of span metadata, and JSON-only bundles may omit spans entirely.

### 4. Shared handover index

`cx bundle` writes a bundle-level index file alongside the section outputs. The index is meant to travel with the section files when multiple outputs are handed over together, so the shared context is externalized without breaking the self-contained section files.

### 5. Manifest build

`cx` writes a canonical manifest that records:

- bundle identity and versions
- source root and bundle directory
- VCS provider (`git`, `fossil`, or `none`)
- dirty state at bundle time (`clean`, `safe_dirty`, or `forced_dirty`)
- list of uncommitted modified files when `forced_dirty`
- checksum algorithm
- the shared bundle index filename
- section outputs
- copied assets
- repository note metadata, including extracted summaries when notes are present
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
- `unsafe_dirty` working tree without `--force` (exit code 7)

These are Category A invariants. They are never configurable away because doing so would make the bundle ambiguous or unverifiable.

## Category B Behaviors

Some operational friction points are configurable:

- overlap handling mode
- missing cx-specific adapter extension mode
- duplicate config entry mode

These are recorded in the lock file so later verification can detect drift between the settings used to build the bundle and the settings currently in effect.

## Why Persistent Token Accounting Matters

Repomix can already calculate token counts while rendering. `cx` adds a different guarantee: those counts are carried forward as part of the artifact contract instead of disappearing with a single run.

That matters in automation because later verification and downstream tooling can read the manifest's recorded token counts directly instead of re-running a render or relying on a fresh estimate in a different environment.

## Why SHA-256 Matters

Checksums are not included for cryptography theater. They prove that the artifacts the runner sees are the same artifacts the bundler emitted.

Why this protects you: checksum failures are evidence that the artifact set in hand is no longer provably the one `cx` wrote. Verification stops before a tampered, partial, or substituted bundle can pass as authoritative.

That lets `verify` detect:

- manifest tampering
- section output drift
- missing checksum entries
- copied asset mutation

For packed text rows, the manifest hash covers the normalized packed content emitted by Repomix. That keeps verification aligned with the actual handover payload instead of pretending `cx` is a source-byte archiver.

## Why Output Spans Matter

When exact span capture is available, the manifest can tell downstream tooling where each file lives in the rendered section output.

Those spans are only useful if the output remains deterministic. That is why degraded extraction is treated carefully: once the parser can no longer reconstruct the packed output cleanly, absolute coordinates can become unsafe for downstream automation.

## Config Safety and Merge Semantics

Configuration files often inherit from other configurations (e.g., project-specific settings extending organization defaults). `cx` enforces explicit merge semantics to prevent silent overwrites and make configuration conflicts visible.

### Merge Rules

When merging two configurations (base and override), `cx` applies these rules:

- **Scalars**: Override wins (right overwrites left). Conflicting scalar values are recorded as conflicts.
- **Arrays**: Append-only semantics (never silent replace). When both base and override have non-empty arrays, they are concatenated. This prevents accidentally dropping existing patterns or values.
- **Objects**: Deep merge (recursive application of rules). Nested structures are merged field-by-field.
- **Undefined**: Treated as "not set". Missing fields in override do not affect base values.
- **Null**: Valid overwrite value. Explicit null in override overwrites base (unlike undefined).

### Conflict Detection

Every merge operation returns a conflict list documenting:

- `path`: The configuration path (e.g., `files.exclude`, `dedup.mode`)
- `reason`: Why the conflict occurred (e.g., "scalar value replaced", "array append behavior")
- `baseValue` and `overrideValue`: The actual conflicting values

This explicit logging lets operators audit configuration inheritance chains and detect unintended changes that silent merges would hide.

### Why This Matters

Configuration is not arbitrary application state. Changes to section definitions, file patterns, or dedup rules affect the reproducibility of a bundle. By making conflicts visible rather than silent, `cx` ensures that operational decisions about configuration are explicit and auditable.

## Extraction Semantics

`cx` classifies extraction outcomes as:

- `intact`: reconstructed text matches the packed-content hash in the manifest
- `copied`: asset restored directly from stored bundle content
- `degraded`: text is recoverable but does not match the packed-content hash in the manifest
- `blocked`: deterministic recovery is not possible from the stored output

`degraded` is intentionally not the default success path. It requires explicit operator consent with `--allow-degraded`.

See [Extraction Safety](EXTRACTION_SAFETY.md) for the operational consequences.
