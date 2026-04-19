# CX

[![CI](https://github.com/wstein/cx-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/wstein/cx-cli/actions/workflows/ci.yml)
[![Security](https://img.shields.io/badge/security-policy-blue)](./SECURITY.md)
[![npm version](https://img.shields.io/npm/v/@wsmy/cx-cli?color=informational)](https://www.npmjs.com/package/@wsmy/cx-cli)
[![GitHub tag](https://img.shields.io/github/v/tag/wstein/cx-cli?label=github%20tag)](https://github.com/wstein/cx-cli/tags)
[![License](https://img.shields.io/github/license/wstein/cx-cli)](https://github.com/wstein/cx-cli/blob/main/LICENSE)

`cx` standardizes AI project context, notes, and agent workflows in one repository-native toolchain.

Mode chooser: [docs/OPERATING_MODES.md](docs/OPERATING_MODES.md)

## Start Here

Run `cx mcp`.

That is the shortest path to value:

1. Run `cx mcp`
2. Watch the agent work on live code
3. Learn the model later in [docs/OPERATING_MODES.md](docs/OPERATING_MODES.md) and [docs/MENTAL_MODEL.md](docs/MENTAL_MODEL.md)

If you only remember one mental model, keep this one:

- `cx mcp` is the live workspace surface.
- `cx notes` is the durable cognition layer.
- `cx bundle` and `cx verify` turn live work into a trusted artifact handoff.

For the one-page map from hypothesis to memory to snapshot to proof, start with [docs/SYSTEM_MAP.md](docs/SYSTEM_MAP.md).

## Choose The Surface

### Live Agent Exploration

Use this path when an LLM agent needs live workspace access, note maintenance, or targeted search.

- Key commands: `cx mcp`, `cx notes`, `cx doctor mcp`, `cx audit summary`
- Goal: expose the live workspace and note graph through MCP
- Outcome: faster investigation without freezing a bundle too early

### Deterministic Artifact Operations

Use this path when the work needs deterministic bundles, artifact integrity, and hard failure semantics.

- Key commands: `cx bundle`, `cx verify`, `cx extract`, `cx validate`
- Goal: produce immutable, bit-for-bit verifiable bundle artifacts with SHA-256 sidecars
- Outcome: a locked manifest that later humans, CI, and automation can trust

## Why The Split Exists

Repomix is great for exploratory work: grab a snapshot, feed a prompt, move on.

`cx` solves the harder follow-through problem. It is for repositories where interactive agent help, durable notes, and reproducible handoffs all need to agree about what was trusted, what was observed, and what was proven.

That changes the design:

- Repomix optimizes for flexible packing. `cx` optimizes for deterministic planning.
- `cx mcp` helps agents inspect live code now.
- `cx notes` preserves reasoning that should survive the session.
- `cx bundle` and `cx verify` freeze and prove the exact handoff later.

The strictness is the feature. If a file lands in two sections, if a checksum drifts, or if extraction becomes approximate instead of deterministic, `cx` makes that visible instead of quietly proceeding.

## What You Get

- VCS-driven master file list with git, fossil, hg, or filesystem fallback
- Section planning that sorts tracked files without inventing new inputs
- Catch-all sections for unmatched tracked files
- Dirty-state guardrails that block tracked-file drift unless you opt in with `--force`
- Differential `--update` bundling that prunes orphaned outputs safely
- One rendered output per section plus a shared handoff index
- Persistent token accounting, note summaries, and behavioral lock data in the manifest
- SHA-256 checksums and manifest-aware `inspect`, `list`, `validate`, `verify`, and `extract`
- Guided overlap diagnosis and repair with `cx doctor`
- `cx notes` commands for note lifecycle, graph inspection, backlinks, and orphans
- Structured `--json` output for CI and automation

## Quick Start

1. `cx init --name demo`
2. `cx inspect --token-breakdown`
3. `cx mcp` for the live workspace path
4. `cx bundle --config cx.toml` for the immutable artifact path

Start with the same timeline in mind: investigate live, preserve durable reasoning, then freeze the handoff once it needs proof.

The invariants that protect downstream automation are explicit:

- SHA-256 checksums prove the emitted artifacts were not silently edited.
- The manifest preserves the exact file inventory, note summaries, token budget, and provenance that later jobs need.
- `verify` compares the bundle back to a source tree so drift becomes explicit evidence.
- Dirty-state gating stops tracked-file changes from masquerading as reviewed inputs.

Trust shorthand:

- Source tree: trusted
- Notes: conditional
- Agent output: untrusted until verified
- Bundle: trusted

## Documentation

- [docs/README.md](docs/README.md) for the formal documentation index
- [docs/SYSTEM_MAP.md](docs/SYSTEM_MAP.md) for the condensed system map
- [docs/MANUAL.md](docs/MANUAL.md) for the operator-first Friday-to-Monday workflow
- [docs/config-reference.md](docs/config-reference.md) for configuration knobs and editor integration
- [notes/README.md](notes/README.md) for the durable repository knowledge layer
- [published schema endpoint](https://wstein.github.io/cx-cli/schemas/cx-config-v1.schema.json) for IDE support (Taplo in VS Code)
- [published coverage status](https://wstein.github.io/cx-cli/coverage/) for the latest public Vitest HTML report from successful `main` CI

Notes governance lane: run `bun run ci:notes:governance` to keep the cognition-layer gate visible outside the docs set.

## Install

Requirements:

- Node.js `>=20.0.0`

Global install:

```bash
npm install -g @wsmy/cx-cli
```

Homebrew install:

```bash
brew install wstein/tap/cx-cli
```

### Release Flow

See [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md) for the release order, environment secrets, and Homebrew tap handoff.

Run from source:

```bash
bun install
bun run build
node bin/cx --help
```

## Quick Start

Initialize a starter config:

```bash
cx init --name demo
```

`cx init` writes `cx.toml`, `cx-mcp.toml`, `.editorconfig`, a workspace-aware `Makefile`, and a `notes/` directory with:

- `Makefile` as a workspace-level entry point for native builds, testing, project cleanup, and workspace tasks; the template switches to language-specific recipes for Go, Rust, TypeScript/Node.js, Python, Java, Elixir, Julia, and Crystal when those markers are present
- `cx-mcp.toml` as the default MCP overlay for agent workflows; it extends `cx.toml` and keeps the MCP workspace config colocated with the repo root
- `.editorconfig` as the shared editor baseline for whitespace and line-ending defaults
- `notes/README.md` as the repository notes guide
- `notes/Templates/Atomic Note Template.md` as the atomic note template

By default, `cx init` preserves existing init files and creates only the missing targets. Use `--force` to overwrite existing generated files.

Supported init templates include: `base`, `rust`, `go`, `typescript`, `python`, `java`, `elixir`, `julia`, and `crystal`.

You can explicitly choose an init template name with:

```bash
cx init --name demo --template typescript
```

To list supported templates:

```bash
cx init --template-list
```

When `--template` is omitted, `cx init` autodetects the workspace environment from files like `package.json`, `go.mod`, `pyproject.toml`, `pom.xml`, and `Cargo.toml`.

The generated notes directory is intentionally part of the repository contract. Keep architectural intent, implementation decisions, and durable project memory close to the code that depends on them.

### Development workflow

- `make test` or `bun run test` runs the fast Vitest unit suite.
- `make verify` or `bun run verify` runs lint, typecheck, build, the Vitest coverage lane, and the Bun compatibility smoke.
- `bun run ci:test:coverage` measures the full shared suite through Vitest and publishes the repository coverage artifacts.
- `bun run test:contracts` runs the contract suite through Vitest.
- `bun run test:all` runs the full shared suite through Vitest without collecting coverage.
- `bun run test:all:full` runs the authoritative Vitest coverage lane.
- `bun run test:vitest:bundle` isolates the slow bundle workflow, extraction, render-adapter, and JSON CLI suites.
- `bun run test:vitest:notes` isolates the slow notes graph and command suites, plus linked-note planning and operator contracts.
- `bun run test:vitest:planning` isolates planning and schema-integration suites for overlap, linked-note, and config-shape work.
- `bun run test:vitest:mcp` runs the focused MCP-heavy Vitest lane for server, policy, audit, and CLI MCP debugging.
- `bun run test:vitest:mcp:ui` opens the MCP lane in Vitest UI so you can rerun failures interactively and inspect coverage or import cost inside the MCP stack.
- `bun run test:vitest:mcp:adversarial` isolates startup hangs, malformed runtime payloads, and other hostile MCP failure modes in a smaller cockpit.
- The `Makefile` delegates to `package.json` scripts using 1:1 shell shim wrappers.
- `package.json` does not expose an explicit `coverage` script; coverage is collected by test executions.

### Editor autocomplete and linting

The generated `cx.toml` includes a schema directive for [Taplo](https://taplo.tamasfe.dev/) (the TOML extension in VS Code). This enables real-time autocomplete, validation, and linting:

```toml
#:schema https://wstein.github.io/cx-cli/schemas/cx-config-v1.schema.json
schema_version = 1
project_name = "myproject"
```

The schema validates structural shape and enum constraints. Runtime validation in `cx load` enforces relational invariants (e.g., catch-all restrictions). See [docs/config-reference.md](docs/config-reference.md#json-schema-for-editor-tooling) for details.

For external tooling, use the published Pages endpoints:

- `https://wstein.github.io/cx-cli/schemas/cx-config-v1.schema.json`
- `https://wstein.github.io/cx-cli/schemas/cx-config-overlay-v1.schema.json`

The npm package also ships `schemas/` so offline consumers can keep using the local files without depending on the public site.

Preview the deterministic plan before writing anything:

```bash
cx inspect --config cx.toml
```

If you want to see which section is carrying the most token budget, use:

```bash
cx inspect --config cx.toml --token-breakdown
```

Build the bundle:

```bash
cx bundle --config cx.toml
```

Apply a differential update (copy changed files only, prune orphaned artifacts):

```bash
cx bundle --config cx.toml --update
```

`--update` stages artifacts in a temporary OS directory first, then syncs the
result into `output_dir` so the final bundle only sees a deterministic, already
validated tree. Pruning is safety-gated: `cx` refuses to prune if the target
directory does not look like an existing bundle directory.

The differential algorithm is intentionally conservative. It is designed to
remove bundle artifacts that disappeared from the manifest while preserving the
rest of the output directory untouched.

Validate and verify it:

Assuming your config writes to `dist/demo-bundle`:

```bash
cx validate dist/demo-bundle
cx verify dist/demo-bundle --against .
```

List stored files:

```bash
cx list dist/demo-bundle
```

Extract one file back out:

```bash
cx extract dist/demo-bundle --file src/index.ts --to /tmp/restore
```

## Typical CI Flow

```bash
CX_STRICT=true cx bundle --config cx.toml
cx verify dist/myproject-bundle --against . --config cx.toml
```

`CX_STRICT=true` forces all configurable Category B behaviors to fail fast. That is the safest default for automated pipelines.

If an operator ever uses `--force` outside CI, add a manifest quarantine step
that rejects `forced_dirty` bundles before promotion. The operator manual
includes ready-to-use `jq` and Node.js examples.

## Command Overview

| Command | Purpose |
| --- | --- |
| `cx init` | Create a starter `cx.toml` and scaffold repository notes |
| `cx inspect` | Show the computed plan without writing files |
| `cx bundle` | Build a deterministic bundle directory |
| `cx list` | List bundle contents grouped by section |
| `cx validate` | Validate bundle structure and schema |
| `cx verify` | Verify bundle integrity and optional source-tree drift |
| `cx extract` | Restore files from a bundle |
| `cx mcp` | Start the MCP server for agentic workflows |
| `cx doctor overlaps` | Diagnose section overlap conflicts |
| `cx doctor fix-overlaps` | Generate or apply exact exclude fixes |
| `cx doctor mcp` | Show the effective MCP profile and inherited file scopes |
| `cx doctor secrets` | Scan the master list for suspicious secret patterns |
| `cx audit summary` | Show recent MCP policy and trace trends from `.cx/audit.log` |
| `cx render` | Render planned sections without building a full bundle |
| `cx config show-effective` | Show resolved behavioral settings and their sources |
| `cx completion` | Generate shell completion scripts |
| `cx notes` | Manage notes and inspect note graph relationships |
| `cx adapter ...` | Inspect adapter capabilities and compatibility |

Every command supports `--json` for machine consumption.

## Shell Completions

Generate and install professional shell completions with command descriptions and context-aware option suggestions:

```bash
# bash
cx completion --shell=bash --install

# zsh
cx completion --shell=zsh --install

# fish
cx completion --shell=fish --install
```

If you prefer a one-off dynamic load instead of writing to your shell config, use:

```bash
# For bash
. <(cx completion --shell=bash)
# For zsh
. <(cx completion --shell=zsh)
# For fish
cx completion --shell=fish | source
```

Open a new shell session after installation. Completions include:
- Full command reference with descriptions
- Global options (`--strict`, `--lenient`, `--adapter-path`)
- Command-specific options for each subcommand
- File path suggestions where applicable

> For even faster discoverability, see the `cx inspect --token-breakdown` example in the Quick Start section above.

## Active Ecosystem

`cx` is designed to participate in agentic workflows, not just produce static archives.

- The manifest records enough metadata for downstream tooling to route by note ID and section without reparsing Markdown.
- The notes graph commands (`cx notes backlinks`, `cx notes orphans`, `cx notes code-links`) make the repository's knowledge layer queryable from the CLI.
- `cx mcp` starts the CX MCP server using `cx-mcp.toml` when available and falls back to `cx.toml` for the baseline agent profile. The server exposes native file-based `list`, `grep`, and `read` tools plus live planning helpers (`inspect`, `bundle`, `doctor_mcp`, `doctor_workflow`) and note-native tools for reading, searching, creating, updating, renaming, deleting, and graph-inspecting repository notes over the active workspace scope.
- `cx doctor mcp` and `cx doctor secrets` provide deterministic diagnostics for the MCP inheritance boundary and the master-list secret scan.

That means an LLM agent can ask for more context, retrieve just the relevant context surface, and reason about the repo as a live system rather than a static artifact.

## The Important Failure Model

Some constraints are non-negotiable:

- section overlap is a hard failure when `dedup.mode = "fail"`; this is the default
- asset collisions are hard failures
- missing core adapter contract is a hard failure
- degraded extraction is blocked unless you explicitly pass `--allow-degraded`

This is intentional. `cx` is designed to stop a pipeline before a bad bundle turns into a harder-to-debug downstream failure. For packed text files, the bundle hash tracks the normalized rendered output, so `verify` and `extract` stay aligned with the actual handover payload instead of source-byte exactness.

## Example `cx.toml`

```toml
schema_version = 1
project_name = "myproject"
source_root = "."
output_dir = "dist/{project}-bundle"

[output.extensions]
xml = ".xml.txt"
json = ".json.txt"
markdown = ".md"
plain = ".txt"

[repomix]
style = "xml"
show_line_numbers = false
include_empty_directories = false
security_check = true

[files]
include = []
exclude = ["node_modules/**", "dist/**", "tmp/**"]
follow_symlinks = false
unmatched = "ignore"

[dedup]
mode = "fail"
order = "config"

[manifest]
format = "json"
pretty = true
include_file_sha256 = true
include_output_sha256 = true
include_output_spans = true
include_source_metadata = true

[checksums]
algorithm = "sha256"
file_name = "{project}.sha256"

[assets]
include = ["**/*.{png,jpg,jpeg,gif,webp,svg,pdf}"]
exclude = []
mode = "copy"
target_dir = "assets"
layout = "flat"

[sections.docs]
include = ["README.md", "docs/**", "notes/**", "*.md"]
exclude = []

[sections.repo]
include = [
  ".gitignore",
  ".github/workflows/ci.yml",
  "biome.json",
  "bin/cx",
  "cx.toml",
  "scripts/**",
  "schemas/**",
  "package.json",
  "tsconfig.json",
  "tsconfig.test.json",
]
exclude = []

[sections.src]
include = ["src/**"]
exclude = []

[sections.tests]
include = ["tests/**"]
exclude = []
```

## Documentation Map

- [Operator Manual](docs/MANUAL.md): end-to-end workflows, including overlap resolution
- [System Map](docs/SYSTEM_MAP.md): condensed entrypoint and subsystem map
- [Architecture](docs/ARCHITECTURE.md): implementation reference for contributors working below the front door
- [Extraction Safety](docs/EXTRACTION_SAFETY.md): packed-content recovery, degraded fallback, and `--allow-degraded`
- [Configuration Reference](docs/config-reference.md): settings, precedence, and examples

## LLM-Friendly Output Extensions

By default, section outputs use these extensions:

- XML: `.xml.txt`
- JSON: `.json.txt`
- Markdown: `.md`
- Plain text: `.txt`

This keeps uploads frictionless across stricter web-based LLM file handlers.
You can override any of them in `cx.toml`:

```toml
[output.extensions]
xml = ".xml.txt"
json = ".json.txt"
markdown = ".md"
plain = ".txt"
```

## Development

The repository-local `make` commands are intentionally small and explicit:

| Command | Use it when |
| --- | --- |
| `make test` | You want the fast unit loop while iterating |
| `make verify` | You want the normal local gate before merging |
| `make release VERSION=x.y.z` | You are stepping through the two-phase release wizard |

```bash
bun install
make test
make verify
make release VERSION=x.y.z
make release VERSION=x.y.z
```

`make test` runs the fast unit suite. `make verify` is the normal local gate:
lint, typecheck, build, the Vitest coverage lane, and Bun compatibility smoke.
`bun run test:all` and `bun run test:all:full` stay on the native Vitest suite
and coverage lanes, while Bun remains in CI only for explicit compatibility
smoke. `make release`
now acts as a two-phase wizard: the first call with a new semantic version starts the
release candidate on `develop`, and the second call with that same version creates and pushes
the tag after CI is green.

If you prefer the underlying Bun commands directly:

```bash
bun run ci:test:coverage
bun run test
bun run verify
VERSION=x.y.z bun run release
VERSION=x.y.z bun run release
```
