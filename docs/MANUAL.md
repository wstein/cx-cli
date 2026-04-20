<!-- Source: MANUAL.md | Status: CANONICAL | Stability: STABLE -->

# CX Operator Manual

`cx` standardizes AI project context, notes, and MCP workflows in one repository-native toolchain.

See: [OPERATING_MODES.md](OPERATING_MODES.md) for the main conceptual entrypoint.
See: [MENTAL_MODEL.md](MENTAL_MODEL.md) for the canonical CX triad, Track A vs Track B, policy tiers, and artifact lifecycle.

Use this manual when you already know you are operating `cx` and want the
shortest route to commands, assurance levels, and workflow decisions.

If you are new to the repository:

1. Read the root [README](../README.md)
2. Read [SYSTEM_MAP.md](SYSTEM_MAP.md)
3. Return here once you need the operator path instead of the conceptual map

---

## Quick Operator Path

Use the smallest operator sequence that matches the job:

- Live investigation: `cx mcp`
- Durable reasoning: `cx notes`
- Frozen handoff: `cx inspect`, `cx bundle`, `cx verify`
- Recovery or audit: `cx validate`, `cx list`, `cx extract`

Typical minimal paths:

### Live Agent Path

1. `cx mcp`
2. `cx doctor mcp`
3. `cx mcp catalog --json`
4. `cx doctor workflow --task "refactor index.ts"`

### Artifact Path

1. `cx init --name demo`
2. `cx inspect --token-breakdown`
3. `cx bundle --config cx.toml`
4. `cx verify --against .`
5. `cx extract dist/bundle --to ./restore`

### Repository Commands

Use the repository-local `make` targets for day-to-day development:

| Command | Use it when |
| --- | --- |
| `make test` | You want the fast unit loop while iterating |
| `make verify` | You want the normal local gate before merging |
| `make certify` | You want CI-grade confidence before tagging a release |
| `make release VERSION=vX.Y.Z` | You are stepping through the two-phase release wizard |

`make certify` runs everything `make verify` does, then performs a clean double-build reproducibility check: the `dist/` tree is hashed, wiped, rebuilt, and hashed again. The two hash sets must match exactly. This mirrors the CI `reproducibility` job so the release gate is exercisable locally without pushing.

## Assurance Ladder

Use these commands as a progressive assurance model:

| Command | What it covers | When to run |
| --- | --- | --- |
| `bun run verify` | lint, typecheck, build, Vitest coverage lane, Bun compatibility smoke | normal pre-merge gate |
| `bun run ci:test:coverage` | Vitest V8 coverage lane with HTML, JSON summary, LCOV, and markdown summary output over the full shared suite | CI coverage reporting |
| `bun run test:all` | full shared repository suite through native Vitest | broad local execution proof |
| `bun run test:vitest:bundle` | focused bundle workflow, extraction, render-adapter, and JSON CLI lane | bundle-heavy local iteration |
| `bun run test:vitest:notes` | focused notes graph, note commands, linked-note planning, and operator contract lane | notes-heavy local iteration |
| `bun run test:vitest:planning` | focused planning and schema-integration lane | overlap, linking, and config-shape iteration |
| `bun run certify` | `verify` + contract lane + Repomix fork compatibility smoke + bundle transition matrix smoke + release integrity smoke + reproducibility check | pre-tag local CI-equivalent certification |
| `bun run integrity` | release integrity metadata generation from the packed npm tarball | release artifact staging |
| `bun run verify-release` | release integrity metadata verification against packed tarball | release verification and audit |

`make verify` and `make certify` are thin wrappers around `bun run verify` and `bun run certify`.

Vitest coverage is now the authoritative coverage-reporting lane for release assurance. Bun remains part of the execution and compatibility matrix.

### CX Commands

Use `cx` commands for repository planning, bundle generation, verification, and live MCP work.

```bash
cx init --name demo
cx inspect --token-breakdown
cx bundle --config cx.toml
cx mcp
cx doctor mcp --config cx.toml
cx mcp catalog --json
cx doctor secrets --config cx.toml
```

`cx init` now writes a generated workspace-aware `Makefile`, `.editorconfig`, `cx-mcp.toml`, `cx.toml`, `.mcp.json`, `.vscode/mcp.json`, and local agent settings in `.claude/settings.json` and `.codex/settings.json` in addition to `notes/`. The generated `cx-mcp.toml` is a minimal diff to `cx.toml` and serves as the MCP overlay for the workspace root. The Makefile selects a language-specific template when it sees common workspace markers for Rust, Go, JavaScript/TypeScript, Python, Java, Elixir, Julia, Crystal, or Zig, and otherwise falls back to the base template.

For the TypeScript template, the generated `Makefile` uses lockfile-first package-manager selection (`bun.lock*`, `pnpm-lock.yaml`, `yarn.lock`, then `package-lock.json` / `npm-shrinkwrap.json`) and keeps `install` separate from `build`. The normalized local targets are `install`, `build`, `test`, `check`, `lint`, `verify`, `certify`, `clean`, and `notes`. `lint` and `check` skip with a clear message when the corresponding package scripts are absent, and `certify` falls back to `verify` unless the workspace defines a stricter package-manager `certify` script. The generated `cx-mcp.toml` is the source-oriented authoring overlay and includes `src/**`, `package.json`, `tsconfig*.json`, and `README.md` while excluding `node_modules/**`, `dist/**`, and common cache or coverage directories. A companion `cx-mcp-build.toml` is generated for compiled-output inspection. Adjust the authoring and build overlays independently if your workspace uses a different layout.

The cross-template capability matrix, generated file contract, and support
levels are documented in [INIT_TEMPLATE_CONTRACT.md](INIT_TEMPLATE_CONTRACT.md).

`cx init` checks each generated target individually. It preserves existing files by default and creates any missing init artifacts; use `--force` to overwrite existing generated files.

Use `--template` to explicitly choose an init template by environment:

```bash
cx init --name demo --template typescript
```

List supported templates with:

```bash
cx init --template-list
```

When `--template` is omitted, `cx init` autodetects the workspace environment from files like `package.json`, `go.mod`, `pyproject.toml`, `pom.xml`, and `Cargo.toml`.

`cx mcp` prefers a colocated `cx-mcp.toml` overlay. If that file is present, it is the default MCP config for the workspace; if it is missing, `cx` falls back to the baseline `cx.toml` configuration. The MCP surface now includes live bundle planning plus note reading, search, creation, update, rename, delete, and note-graph inspection tools in addition to workspace file browsing.

Use `cx mcp catalog --json` when you need only the machine-readable MCP tool contract. It exposes the registered tool set with stable `name`, `capability`, and `stability` fields plus summary counts, without mixing in profile resolution or audit state.

For concrete integration examples and per-IDE snippets (VS Code/Cline, Roo Code, Cursor, Claude Desktop), see the [Agent Integration Guide](AGENT_INTEGRATION.md).

Repository-local `make` shortcuts keep the developer loop compact:

- `make test` runs the fast Vitest unit suite.
- `make verify` runs lint, typecheck, build, the Vitest coverage lane, and Bun compatibility smoke.
- `bun run ci:test:coverage` runs the authoritative Vitest V8 coverage lane across the shared repository suite, then writes `coverage/vitest/` plus `.ci/coverage-summary.md` for CI reporting.
- Treat that Vitest lane as the authoritative release-assurance reporting surface. The Bun lanes still prove execution compatibility and remain part of the runtime matrix.
- `bun run test:contracts` runs the contract suite through native Vitest.
- `bun run test:all` runs the full shared suite through native Vitest without collecting coverage.
- `bun run test:all:full` is the explicit Vitest coverage lane for local release-assurance checks.
- `bun run test:vitest:bundle` isolates the slow bundle workflow, extraction, render-adapter, and JSON CLI suites.
- `bun run test:vitest:notes` isolates the slow notes graph and command suites, plus linked-note planning and operator contracts.
- `bun run test:vitest:planning` isolates planning and schema-integration suites for overlap, linked-note, and config-shape work.
- `bun run pages:build` assembles the public Pages `site/` tree with `/schemas/` and `/coverage/`.
- `bun run pages:smoke` validates that staged `site/` tree before a workflow publishes it.
- The latest public HTML coverage view is published at `https://wstein.github.io/cx-cli/coverage/` from successful `main` CI runs.
- `bun run test:vitest:mcp` runs the focused MCP cockpit lane for MCP-heavy tests without starting the full repository coverage surface.
- `bun run test:vitest:mcp:ui` opens the same MCP-focused lane in Vitest UI so operators can rerun failures, inspect coverage, and review the import graph for slow MCP startup or registration paths.
- `bun run test:vitest:mcp:adversarial` keeps startup failures, malformed runtime responses, and other hostile-boundary MCP cases isolated in a smaller cockpit.
- `make certify` runs everything `verify` does plus contract tests, smoke lanes, release integrity smoke, and reproducibility checks — the CI-grade local gate to use before tagging.
- `make release VERSION=vX.Y.Z` is a wizard: first call starts the release candidate on `develop`, second call with that same tagged version finalizes the release after CI is green.

The `make` targets are wrappers around the corresponding Bun scripts. Use them
for local ergonomics; use `cx` when you are working with bundle planning,
verification, extraction, or MCP sessions.

The native MCP server exposes file-based `list`, `grep`, and `read` tools over
the workspace scope. It also exposes `inspect`, `bundle`, `doctor_mcp`, and
`doctor_workflow` tools for live planning, plus note-native `notes_read`,
`notes_search`, `notes_new`, `notes_update`, `notes_rename`, `notes_delete`,
`notes_list`, `notes_backlinks`, `notes_orphans`, `notes_code_links`, and
`notes_links` tools over the notes corpus. Use `list` to enumerate visible
files, `grep` to search their contents, and `read` to inspect a specific file
with optional line anchors without switching back to the packaging workflow.

Example note search:

```json
{
  "tool": "notes_search",
  "arguments": {
    "query": "workflow",
    "tags": ["agent"],
    "limit": 5
  }
}
```

CLI and MCP note commands side by side:

| Task | CLI | MCP |
| --- | --- | --- |
| Create a note | `cx notes new --title "Research Note" --body "Initial observation."` | `notes_new(title="Research Note", body="Initial observation.")` |
| Read a note | `cx notes read --id 20260414120000` | `notes_read(id="20260414120000")` |
| Update a note | `cx notes update --id 20260414120000 --body "Refined observation."` | `notes_update(id="20260414120000", body="Refined observation.")` |
| Rename a note | `cx notes rename --id 20260414120000 --title "Research Note v2"` | `notes_rename(id="20260414120000", title="Research Note v2")` |
| Delete a note | `cx notes delete --id 20260414120000` | `notes_delete(id="20260414120000")` |
| Inspect the graph | `cx notes links` / `cx notes backlinks --id ...` / `cx notes orphans` / `cx notes code-links --id ...` | `notes_search(...)` / `notes_links(...)` / `notes_backlinks(...)` / `notes_orphans(...)` / `notes_code_links(...)` |

Use the CLI for direct on-disk note lifecycle operations. Use MCP when the agent needs live search, reads, updates, or graph inspection inside an active workspace session.

## Who This Manual Is For

This guide is for engineers running `cx` as an operational tool: local bundle authors, CI maintainers, and remote-runner owners.

If you are new to the project, read the README first. If you need the detailed
knobs, read [Configuration Reference](config-reference.md). If you need the full
documentation map, read [docs/README.md](README.md).

## Friday To Monday Map

Read the rest of this manual with one concrete timeline in mind:

- SHA-256 sidecars prove the emitted artifacts were not silently edited after bundling.
- The manifest records the exact file inventory, token counts, note summaries, and dirty-state provenance that downstream automation relies on.
- `verify` exists so Monday's runner can compare the bundle back to a source tree instead of trusting a stale directory by habit.
- Dirty-state gating stops tracked-file drift from becoming an unreviewable production input.

The invariants are the mechanisms that keep Friday's intent queryable and safe on Monday.

See: [WORKFLOWS/friday-to-monday.md](WORKFLOWS/friday-to-monday.md)

## Static Bundle Versus Live MCP

See: [MENTAL_MODEL.md](MENTAL_MODEL.md)

The two main CX workflows are intentionally different:

- `cx bundle` produces a static, immutable snapshot for CI, review, verification, and handoff.
- `cx mcp` exposes the live workspace through scoped file, search, and note tools for active investigation.

They share the same repository boundary rules, but they answer different questions. Use the bundle when you need something you can verify later. Use MCP when you need the model to explore, search, or update the workspace during an ongoing task.

| Command | Best for | Typical output |
| --- | --- | --- |
| `cx inspect` | Reviewing the planned bundle before writing files | A deterministic plan, token totals, overlap signals, and extractability hints |
| `cx bundle` | Producing an immutable artifact for review, CI, or handoff | Bundle files, manifest, lock file, and checksum sidecar |
| `cx mcp` | Exploring the live workspace and maintaining notes during active work | Scoped file search, reads, and note tools over the current workspace |

## Core Commands

| Command | Use it when |
| --- | --- |
| `cx init` | You need a starter config |
| `cx inspect` | You want to preview the plan before building |
| `cx bundle` | You want to produce the bundle artifacts |
| `cx validate` | You want schema and structure validation |
| `cx verify` | You want checksum and source-tree verification |
| `cx list` | You want to browse stored files and statuses |
| `cx extract` | You want to restore selected files from the bundle |
| `cx mcp` | You want to start the MCP server with the agent profile |
| `cx notes` | You want to manage notes or inspect note graph relationships |
| `cx doctor overlaps` | A plan fails because one file matches multiple sections |
| `cx doctor fix-overlaps` | You want exact exclude entries generated or applied |
| `cx doctor mcp` | You want to review the effective MCP profile, inherited scopes, and recent audit trends |
| `cx mcp catalog --json` | You want the narrow machine-readable MCP tool catalog for automation |
| `cx doctor notes` | You want to audit note-to-code references against the VCS-backed planning master list |
| `cx doctor secrets` | You want to scan the master list for suspicious secret patterns |
| `cx doctor workflow` | You want a quick recommendation for bundle, inspect, or MCP, including mixed-task paths |
| `cx audit summary` | You want recent `traceId`, policy, and capability trends from `.cx/audit.log` without the full MCP profile report |
| `cx completion` | You want shell-native command and flag completion |

## Standard Workflow

### 1. Create or inspect config

```bash
cx init --name demo
cx inspect --config cx.toml
```

`cx init` scaffolds both `cx.toml` and a `notes/` directory containing the repository notes guide plus the default atomic note template. It also chooses a workspace-native Makefile template so the generated recipes stay readable and aligned with the detected toolchain.

For MCP workflows, create a colocated `cx-mcp.toml` that extends `cx.toml`. `cx mcp` prefers the overlay when it exists and falls back to the baseline config when it does not.

Use `cx notes links` to audit unresolved note and code references after notes have been added or renamed. That command surfaces broken graph edges without changing the repository contract.

Example workflow: start with `cx inspect` to confirm the planned bundle, run `cx bundle` to produce the immutable artifact, then switch to `cx mcp` when the task becomes exploratory or when the agent needs to update notes in place.

For mixed tasks that need a planning pass and live note updates, `cx doctor workflow --task '...'` can recommend an ordered path such as `inspect -> bundle -> mcp`.

```bash
cx inspect --config cx.toml --token-breakdown
cx bundle --config cx.toml
cx mcp
```

### MCP Diagnostics

Use the doctor subcommands when you want to inspect the agent boundary directly:

```bash
cx doctor mcp --config cx.toml
cx doctor notes --config cx.toml
cx doctor secrets --config cx.toml
cx audit summary --json
```

`cx doctor mcp` shows the resolved MCP profile and the effective `files.include` and `files.exclude` arrays. `cx doctor notes` audits note wikilinks that look like repository paths against the planning master list after `files.include` and `files.exclude` are applied. `cx doctor secrets` scans that same master list for suspicious credentials using the same security rules the planning workflow relies on.

Bundle-time scanner enforcement is controlled separately:

```toml
[scanner]
mode = "warn"  # or "fail"
```

With `scanner.mode = "warn"`, `cx bundle` emits scanner findings as warnings and
continues. With `scanner.mode = "fail"`, the same core findings block the
bundle before proof artifacts are finalized.

`cx mcp catalog --json` is the preferred narrow machine-readable endpoint for MCP tool metadata. `cx doctor mcp --json` also exposes the same catalog fields when you need them alongside profile resolution and audit trends.

When you only need the audit ledger itself, `cx audit summary --json` reports allowed versus denied totals, policy-name counts, capability counts, and recent `traceId` values from `.cx/audit.log` without repeating the rest of the MCP profile.

When overlap analysis is the issue, the output names the conflicting file, the matching sections, the recommended owner, and the sections that should exclude the file. For example:

```text
Detected 1 section overlap in cx.toml.

src/index.ts
  matching sections: src, mixed
  owner: src
  exclude from: mixed
```

Use `inspect` before `bundle` whenever you are changing section boundaries, asset rules, or exclusion patterns.

### Linked-Note Enrichment (Operator View)

When `manifest.includeLinkedNotes = true`, `cx` runs linked-note enrichment after the VCS planning phase and before rendering.

- This is inclusion-changing behavior: linked note files can be added to the selected section file list.
- Injection is targeted: linked notes are appended to `docs` when that section exists, otherwise to the first configured section.
- Injection is constrained: notes already claimed by sections or assets are not duplicated.
- Injection is deterministic: injected files are sorted lexicographically within the target section.

You can inspect the effect before bundling:

```bash
cx inspect --config cx.toml --json
```

Injected note rows expose explicit inclusion provenance in the inspect payload:
`linked_note_enrichment` marks the post-planning note injection step,
`manifest_note_inclusion` records that the manifest setting caused the note to
appear, direct section members report `section_match`, catch-all section members
report `catch_all_section_match`, and copied assets report `asset_rule_match`.
Human-facing `cx bundle` output and the generated shared handover also include a
provenance rollup so operators can confirm inclusion reasons without switching
to JSON inspection first.

Shared handover content can optionally include recent repository history through
`[handover]` config:

```toml
[handover]
include_repo_history = true
repo_history_count = 25
```

When enabled, `cx` records the newest bounded commit messages in deterministic
newest-first order for Git, Mercurial, and Fossil repositories. Multiline
messages are preserved, and diffs are never embedded in the handover.

For XML-style bundles, the shared handover stays mostly plain text and uses a
small set of rare XML tags as semantic anchors for LLMs and operators. It is
not a full XML serialization contract.

For `json` bundles, `cx` also validates the shared handover and JSON section
outputs against the published JSON artifact contracts before the bundle is
accepted.

Published Pages URLs:

- `https://wstein.github.io/cx-cli/schemas/shared-handover-v2.schema.json`
- `https://wstein.github.io/cx-cli/schemas/json-section-output-v1.schema.json`

Then verify graph reachability from a seed note:

```bash
cx notes graph --id <note-id> --depth 2
```

For graph traversal, `--depth` is the maximum wikilink hop count from the seed note. `--depth 1` returns direct links only, while higher values include transitive reachable notes up to that bound.

If you want note quality to become a bundle gate in CI or other
high-assurance environments, add:

```toml
[notes]
require_cognition_score = 80
strict_notes_mode = true
fail_on_drift_pressured_notes = true
applies_to_sections = ["docs"]
```

This uses the same effective cognition model as `cx notes check`, including
drift and contradiction pressure. `strict_notes_mode` raises the bar further:
every gated note must remain `high_signal`, not merely above a numeric
threshold.

`fail_on_drift_pressured_notes` is stricter still. It rejects gated notes whose
score may still be acceptable overall but that are already under note-to-code
drift pressure.

If you are checking whether a section is becoming too large, run:

```bash
cx inspect --config cx.toml --token-breakdown
```

That prints a compact per-section histogram so you can see which section is carrying most of the token budget before you build the bundle.

Example output:

```text
Token breakdown
 SECTION  TOKENS   SHARE   GRAPH
 docs        411   53.4%  ████████████████
 repo        198   25.7%  ████████
 src         161   20.9%  ██████
 Total       770  100.0%  ████████████████████████
```

### 2. Build the bundle

```bash
cx bundle --config cx.toml
```

For iterative local workflows, use differential update mode:

```bash
cx bundle --config cx.toml --update
```

If the working tree has uncommitted modifications to tracked files, `cx bundle`
aborts with exit code 7 to prevent an unverifiable bundle. Use `--force` to
override this guard for local experimentation:

```bash
cx bundle --config cx.toml --force
```

`--force` sets the manifest `dirtyState` to `forced_dirty` and records the
list of modified files. Do not use `--force` in CI pipelines.

`--update` renders into an OS temporary staging directory and synchronizes only
changed files into the final bundle directory. Files no longer present in the
new manifest are pruned.

Think of `--update` as a deterministic staging-sync algorithm: first the full
bundle is assembled in isolation, then the diff is applied to the live output
directory. That keeps the final directory coherent even when a run is interrupted
mid-build.

Pruning is guarded by a safety lock: if the target directory does not contain a
bundle marker (`*-manifest.json` or `*-lock.json`), `cx` aborts instead of
deleting files.

This writes:

- one rendered output per section
- a shared handover file for multi-file handover
- copied assets
- `{project}-manifest.json`
- `{project}-lock.json`
- `{project}.sha256` or your configured checksum filename

Each rendered section also starts with a canonical handover prolog. The prolog is guidance, not authority: it explains that the file is a deterministic section snapshot, that logical paths refer back to original repository files, and that edits should be made in the source tree before rebuilding the bundle. Canonical semantics still come from the packed structure itself plus `cx-meta`, `cx-policy`, archive markers, the manifest, and validation rules.

### 3. Validate and verify

Assuming your config writes to `dist/demo-bundle`:

```bash
cx validate dist/demo-bundle
cx verify dist/demo-bundle --against . --config cx.toml
```

`validate` checks the bundle structure and schema.

`verify` checks checksums and can compare the bundle back to a source tree with `--against`. It also reads the lock file and warns if the behavioral settings currently in effect differ from the settings used when the bundle was built.

Why this protects you: a checksum failure means Monday's runner is no longer looking at exactly the artifact Friday wrote. `cx verify` stops before a modified, incomplete, or substituted bundle is treated as trustworthy input.

When `validate`, `verify`, or `extract` fail with an operational `CxError`, the
CLI now prints a suggested follow-up command, a documentation reference, and
concrete next steps. The JSON output carries the same remediation block under
`error.remediation` so automation can guide operators instead of only reporting
the failure.

### 4. List or extract

```bash
cx list dist/demo-bundle
cx extract dist/demo-bundle --to /tmp/restore --file src/index.ts
```

Use `list` when you want visibility. Use `extract` when you need reconstruction.

`cx notes check` also audits note wikilinks that look like repository file
paths. If a note points at a missing file or one that exists on disk but is not
part of the VCS-derived master list, `cx` reports a warning without failing the
check.

## Recommended Bundle Layout

For this repository, prefer four stable sections:

- `docs` for human-facing documentation, root markdown, and repository notes under `notes/`
- `repo` for repository metadata, config, scripts, and schemas
- `src` for production implementation
- `tests` for regression coverage

Do not create mini sections for `scripts` or `schemas` on their own unless there is a strong ownership boundary. Keep the `repo` section broad enough to be useful, but watch its size. As a practical rule, if a section becomes hard to scan in `cx list` or grows into the many-thousands-of-tokens range, revisit the boundary for a real design reason, not just to reduce file count.

If `tmp/` is only for scratch work, exclude it from planning so it does not pollute unmatched-file reporting.

## Workflow: Handling Section Overlaps

This is the most important operator workflow because overlap resolution is a sequence, not a single command.

### Incident

You add a new file such as `src/utils/shared.ts`. Two section globs now claim it.

Example:

- `sections.frontend.include = ["src/**/*.ts"]`
- `sections.backend.include = ["src/utils/**"]`

If overlap failure mode is active, bundling stops because the same file cannot belong to two canonical section definitions at once.

### Why `cx` Stops

`cx` treats overlap as a planning error because duplicate ownership breaks determinism:

- the same source file would appear in multiple rendered outputs
- token budgeting becomes inflated
- the manifest no longer has one clear section of truth for that file
- downstream tooling has to guess which ownership was intended

Why this stops you: overlap failure protects the one-file, one-owner invariant. If `cx` allowed duplicate ownership to proceed, the bundle would stop being deterministic at the exact moment it claimed to be canonical.

### Step 1: Diagnose

```bash
cx doctor overlaps --config cx.toml
```

This command does not mutate anything. It reports:

- the conflicted path
- every matching section
- the recommended owner

Use `--json` in CI if you want machine-readable conflict data.

### Step 2: Preview the fix

```bash
cx doctor fix-overlaps --config cx.toml --dry-run
```

This generates the exact `sections.<name>.exclude` updates needed to preserve one owner and exclude the file from the other sections.

Use this when you want reviewable output in CI or in a pull request discussion.

### Step 3: Apply the fix

Automatic recommended ownership:

```bash
cx doctor fix-overlaps --config cx.toml
```

Interactive ownership selection:

```bash
cx doctor fix-overlaps --config cx.toml --interactive
```

Interactive mode is the safest choice when the recommended owner is not obviously correct.

If you want dynamic overlap resolution without implicit tie-break ownership,
use:

```toml
[dedup]
mode = "first-wins"
require_explicit_ownership = true
```

That keeps the dynamic ownership model, but turns equal-priority overlaps back
into hard failures instead of silently falling back to config or lexical order.

### Step 4: Re-run the pipeline

```bash
cx inspect --config cx.toml
cx bundle --config cx.toml
```

Do not stop after editing the config. Re-run `inspect` or `bundle` immediately so the repaired manifest plan is confirmed in the same terminal session.

## Workflow: VCS Dirty State

`cx` classifies the working tree before planning and records the result in the
manifest.

| State | Meaning | Default |
|---|---|---|
| `clean` | No modifications or untracked files | Proceeds normally |
| `safe_dirty` | Untracked files only | Proceeds with a warning |
| `unsafe_dirty` | Tracked files have uncommitted changes | Aborts (exit code 7) |
| `forced_dirty` | `unsafe_dirty` overridden via `--force` | Proceeds with a warning |

The `unsafe_dirty` guard is a Category A invariant. It cannot be configured
away with `--strict` / `--lenient` or env vars. The only override is the
per-invocation `--force` flag:

```bash
cx bundle --config cx.toml --force
```

When `--force` is used, the manifest records `dirtyState = "forced_dirty"` and
includes the list of modified files in `modifiedFiles`. This lets reviewers see
exactly which files were dirty when the bundle was built.

Keep the escape hatch for local emergencies. Do not rely on terminal warnings
alone to contain it. Downstream automation should quarantine `forced_dirty`
bundles before they enter a promotion path.

Why this stops you: tracked-file drift means the bundle would describe a moving working directory instead of a stable VCS-backed source state. Refusing to bundle keeps review, verification, and later extraction anchored to something that can actually be reproduced.

The dirty-state taxonomy is deliberately asymmetric:

- `clean` and `safe_dirty` are acceptable bundle inputs.
- `unsafe_dirty` is a hard stop because tracked file drift would make the bundle
 unverifiable.
- `forced_dirty` is not a separate cleanliness level; it is an explicit audit
 record that the operator chose to bypass the stop with `--force`.

In CI, never pass `--force`. A dirty tracked file on a CI runner usually means
a generated output was checked in, a patch was applied without committing, or
the wrong branch was used.

The dirty-state check is bypassed entirely when no VCS is detected (filesystem
fallback). In that case, `vcsProvider = "none"` and `dirtyState = "clean"` are
recorded unconditionally.

### Downstream Quarantine For `forced_dirty`

If a midnight hotfix requires `--force`, treat the resulting bundle as a
quarantine candidate until another system explicitly approves it.

`jq` gate:

```bash
manifest=$(echo dist/myproject-bundle/*-manifest.json)

state=$(jq -r '.dirtyState // ""' "$manifest")

case "$state" in
	clean|safe_dirty)
		echo "cx manifest state: $state"
		;;
	forced_dirty)
		echo "Quarantining forced_dirty bundle: $manifest" >&2
		jq -r '.modifiedFiles[]?' "$manifest" >&2
		exit 42
		;;
	*)
		echo "Unknown dirtyState '$state' in $manifest" >&2
		exit 43
		;;
esac
```

Node.js gate:

```js
import fs from "node:fs";

const manifestPath = process.argv[2];

if (!manifestPath) {
	console.error("Usage: node quarantine-dirty.mjs <manifest.json>");
	process.exit(64);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const dirtyState = manifest.dirtyState;

if (dirtyState === "clean" || dirtyState === "safe_dirty") {
	console.log(`cx manifest state: ${dirtyState}`);
	process.exit(0);
}

if (dirtyState === "forced_dirty") {
	console.error(`Quarantining forced_dirty bundle: ${manifestPath}`);
	for (const file of manifest.modifiedFiles ?? []) {
		console.error(`  modified: ${file}`);
	}
	process.exit(42);
}

console.error(`Unknown dirtyState '${dirtyState}' in ${manifestPath}`);
process.exit(43);
```

These scripts make the bundle self-describing for machines: operators can use
`--force` when necessary, and CI can still halt promotion based on manifest
data instead of log scraping.

Longer term, this logic could move into a native command such as
`cx verify --quarantine-dirty`, but the current manifest format already gives
you the structured data needed to enforce the policy today.

## Workflow: Safe CI Operation

For automated pipelines, prefer strict mode:

```bash
CX_STRICT=true cx bundle --config cx.toml
cx verify dist/myproject-bundle --against . --config cx.toml
```

This forces all Category B behaviors to fail, not warn. That matters because warning-only behavior is easy to miss in logs and can otherwise drift into production habits.

If your process permits emergency `--force` usage outside CI, add a post-bundle
manifest gate like the examples above so any `forced_dirty` artifact is
quarantined before deployment, publication, or secondary indexing.

If you cannot set environment variables at the job level, use:

```bash
cx --strict bundle --config cx.toml
```

Inspect current effective behavior with:

```bash
cx config show-effective --config cx.toml
```

## Workflow: Rendering Without a Full Bundle

When you only need the rendered section output:

```bash
cx render --section src --stdout
```

Use `render` for render-only diagnostics or one-off inspection. Use `bundle` when you need the full contract: manifest, checksums, lock file, and later verification.

Text sections in a bundle require exact output spans. JSON-only bundles may omit spans, but any bundle that includes XML, Markdown, or plain sections must keep `manifest.include_output_spans = true` so extraction remains deterministic.

## Workflow: Recovery and Extraction

Basic extraction:

```bash
cx extract dist/demo-bundle --to /tmp/restore
```

Selected sections or files:

```bash
cx extract dist/demo-bundle --to /tmp/restore --section src
cx extract dist/demo-bundle --to /tmp/restore --file src/index.ts
```

Verification during extraction:

```bash
cx extract dist/demo-bundle --to /tmp/restore --verify
```

Why this stops you: extraction is only safe when the manifest hashes and output spans still describe the packed content exactly. If that mapping drifts, `cx` refuses to turn an approximate reconstruction into an authoritative file by default.

If extraction is blocked by degraded packed-content recovery, stop and read [Extraction Safety](EXTRACTION_SAFETY.md) before using `--allow-degraded`.

## JSON Output for Automation

Every major command supports `--json`.

Use it when:

- CI needs structured pass/fail output
- you want to classify verification failures
- another tool needs the overlap report
- a dashboard or automation layer should consume bundle metadata directly

Prefer `--json` for machines and human output for operators. Mixing the two usually leads to brittle parsing.

## Workflow: Install Shell Completions

Generate completion scripts through yargs for your active shell.

```bash
# bash
cx completion --shell=bash >> ~/.bashrc

# zsh
cx completion --shell=zsh >> ~/.zshrc

# fish
cx completion --shell=fish > ~/.config/fish/completions/cx.fish
```

Restart your shell after installing or updating completion scripts.

## Workflow: Linked-Note Injection

When `manifest.include_linked_notes = true` is set in `cx.toml`, `cx bundle`
automatically injects notes that are referenced by at least one wikilink into
the bundle plan after the VCS-driven file selection phase.

```toml
[manifest]
include_linked_notes = true
```

### Injection Rules

- Only notes with **at least one incoming wikilink** are injected. Orphan notes
  (no links in or out) are never added automatically.
- Notes already claimed by a section glob are **not duplicated**. The injection
  step skips any note whose relative path is already present in the plan.
- The injected notes land in the **`docs` section** if one exists; otherwise
  they go into the first section in config order.
- Within the target section, files are re-sorted lexicographically after
  injection so the plan output is deterministic regardless of graph traversal
  order.

### Why Not Every Note?

Note injection is link-driven by design. An orphan note is structurally
disconnected from your codebase — no file, comment, or other note points to it.
Including orphans automatically would pollute bundle context with unrelated
notes. If you want an orphan included, either add a wikilink to it from a source
file or a related note, or list it explicitly in a section glob.

### Detecting What Was Injected

Run `cx inspect --config cx.toml` before bundling to confirm which notes the
enrichment step would add:

```bash
cx inspect --config cx.toml --token-breakdown
```

Look for entries under the `docs` section (or your first section) that originate
from `notes/`. These were injected by the linked-note enrichment step.

### Graph Commands That Complement Injection

| Command | What it tells you |
|---|---|
| `cx notes orphans` | Notes with no links in or out — not injected unless explicitly added |
| `cx notes backlinks --id <id>` | Which notes or source files link to a given note |
| `cx notes links` | Global broken-link audit across the full note graph |
| `cx notes graph --id <id> --depth 2` | All notes reachable from a seed within N hops |

Use `cx notes orphans` after adding new notes to discover what is still
disconnected before the next bundle run.

## Recommended Reading Order

1. README
2. This manual
3. [System Map](SYSTEM_MAP.md)
4. [Extraction Safety](EXTRACTION_SAFETY.md)
5. [Configuration Reference](config-reference.md)
6. [Architecture](ARCHITECTURE.md) if you need the implementation-reference layer
