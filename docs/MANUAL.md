# CX Operator Manual

`cx` exists to provide a unified suite of tooling and standards for AI-driven projects. It standardizes LLM context ingestion, integrates repository-native Zettelkasten knowledge graphs, and provides OS-neutral MCP tools.

## Quick Operator Path

If you want the shortest path to a useful result, use this flow:

1. Initialize the workspace config, notes, and generated Makefile.
2. Inspect the token budget before you bundle.
3. Build native artifacts using the workspace toolchain.
4. Package the cx bundle and run diagnostics.

```bash
cx init --name demo
make build
make bundle
make validate
make inspect
cx mcp
cx doctor mcp --config cx.toml
cx doctor secrets --config cx.toml
```

`cx init` now writes a generated workspace-aware `Makefile`, `cx-mcp.toml`, and `cx.toml` in addition to `notes/`. The generated `cx-mcp.toml` is a minimal diff to `cx.toml` and extends the baseline configuration with starter agent client profiles for Claude, GitHub Copilot, and Codex. The Makefile selects a language-specific template when it sees common workspace markers for Rust, Go, JavaScript/TypeScript, Python, Java, Elixir, Julia, or Crystal, and otherwise falls back to the base template.

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

`cx mcp` prefers a colocated `cx-mcp.toml` profile. If that file is present, it is the default agent profile; if it is missing, `cx` falls back to the baseline `cx.toml` configuration. The MCP surface now includes live bundle planning plus note reading, search, creation, update, rename, delete, and note-graph inspection tools in addition to workspace file browsing.

For concrete integration examples and per-IDE snippets (VS Code/Cline, Roo Code, Cursor, Claude Desktop), see the [Agent Integration Guide](AGENT_INTEGRATION.md).

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

## Who This Manual Is For

This guide is for engineers running `cx` as an operational tool: local bundle authors, CI maintainers, and remote-runner owners.

If you are new to the project, read the README first. If you need the invariants and internal model, read [Architecture](ARCHITECTURE.md). If you need the detailed knobs, read [Configuration Reference](config-reference.md).

For the full documentation map, see [docs/README.md](README.md). For the
editorial consensus behind the docs, see [spec-draft.md](spec-draft.md).

## Friday To Monday Map

Read the rest of this manual with one concrete timeline in mind.

Friday afternoon, you cut a bundle from a repository state that has to survive a weekend of branch churn, half-finished experiments, and CI retries. Monday morning, a remote runner or LLM agent opens that bundle and must be able to trust what it sees without asking a human what changed in between.

That is why `cx` keeps the hard edges:

- SHA-256 sidecars prove the emitted artifacts were not silently edited after bundling.
- The manifest records the exact file inventory, token counts, note summaries, and dirty-state provenance that downstream automation relies on.
- `verify` exists so Monday's runner can compare the bundle back to a source tree instead of trusting a stale directory by habit.
- Dirty-state gating stops tracked-file drift from becoming an unreviewable production input.

The invariants are not philosophical decoration. They are the mechanisms that keep Friday's intent queryable and safe on Monday.

## Static Bundle Versus Live MCP

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
| `cx notes links` | You want to audit unresolved note or code references |
| `cx doctor overlaps` | A plan fails because one file matches multiple sections |
| `cx doctor fix-overlaps` | You want exact exclude entries generated or applied |
| `cx doctor mcp` | You want to review the effective MCP profile and inherited scopes |
| `cx doctor secrets` | You want to scan the master list for suspicious secret patterns |
| `cx doctor workflow` | You want a quick recommendation for bundle, inspect, or MCP, including mixed-task paths |
| `cx completion` | You want shell-native command and flag completion |

## Standard Workflow

### 1. Create or inspect config

```bash
cx init --name demo
cx inspect --config cx.toml
```

`cx init` scaffolds both `cx.toml` and a `notes/` directory containing the repository notes guide plus the default atomic note template. It also chooses a workspace-native Makefile template so the generated recipes stay readable and aligned with the detected toolchain.

For MCP workflows, create a colocated `cx-mcp.toml` that extends `cx.toml`. `cx mcp` prefers the MCP profile when it exists and falls back to the baseline config when it does not.

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
cx doctor secrets --config cx.toml
```

`cx doctor mcp` shows the resolved MCP profile and the effective `files.include` and `files.exclude` arrays. `cx doctor secrets` scans the master list for suspicious credentials using the same security rules the planning workflow relies on.

Use `inspect` before `bundle` whenever you are changing section boundaries, asset rules, or exclusion patterns.

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
- a shared bundle index file for multi-file handover
- copied assets
- `{project}-manifest.json`
- `{project}-lock.json`
- `{project}.sha256` or your configured checksum filename

### 3. Validate and verify

Assuming your config writes to `dist/demo-bundle`:

```bash
cx validate dist/demo-bundle
cx verify dist/demo-bundle --against . --config cx.toml
```

`validate` checks the bundle structure and schema.

`verify` checks checksums and can compare the bundle back to a source tree with `--against`. It also reads the lock file and warns if the behavioral settings currently in effect differ from the settings used when the bundle was built.

### 4. List or extract

```bash
cx list dist/demo-bundle
cx extract dist/demo-bundle --to /tmp/restore --file src/index.ts
```

Use `list` when you want visibility. Use `extract` when you need reconstruction.

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

## Recommended Reading Order

1. README
2. This manual
3. [Architecture](ARCHITECTURE.md)
4. [Extraction Safety](EXTRACTION_SAFETY.md)
5. [Configuration Reference](config-reference.md)
