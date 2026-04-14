# CX

`cx` provides tooling and standards for AI-driven projects in one unified suite. It standardizes LLM context ingestion, integrates repository-native Zettelkasten knowledge graphs, and provides OS-neutral MCP tools that operate seamlessly from the local developer machine through to automated CI/CD pipelines.

Start with the operator path:

1. `cx init --name demo`
2. `cx inspect --token-breakdown`
3. `cx bundle --config cx.toml`
4. `cx mcp`
5. `cx doctor mcp`
6. `cx doctor secrets`

Read those commands through one timeline.

Friday, you build a bundle that has to survive branch churn, partial edits, and CI retries. Monday, an agent or remote runner opens that bundle and must be able to trust it without reconstructing the human story from scratch. That is why `cx` writes manifests, checksum sidecars, token counts, and dirty-state provenance instead of acting like a disposable prompt packer.

The strict invariants protect downstream automation:

- SHA-256 checksums prove the emitted artifacts were not silently edited.
- The manifest preserves the exact file inventory, note summaries, and token budget that later jobs need.
- `verify` compares the bundle back to a source tree so drift is explicit.
- Dirty-state gating stops tracked-file changes from masquerading as reviewed inputs.

It plans repository sections, renders one output per section, copies selected raw assets, and writes a canonical manifest plus SHA-256 checksum sidecar. The result is a bundle that can be verified, inspected, listed, and extracted later without guessing what changed.

It also scaffolds repository notes and exposes graph-oriented note commands so the human intent layer stays close to the code it explains. The manifest carries enough metadata for downstream agents to reason about the project without reparsing Markdown.

## Documentation

- [docs/README.md](docs/README.md) for the formal documentation index
- [docs/MANUAL.md](docs/MANUAL.md) for the operator-first Friday-to-Monday workflow
- [docs/spec-draft.md](docs/spec-draft.md) for the editorial consensus draft
- [docs/config-reference.md](docs/config-reference.md) for configuration knobs and editor integration
- [notes/README.md](notes/README.md) for the permanent repository knowledge layer
- [schemas/cx-config-v1.schema.json](schemas/cx-config-v1.schema.json) for IDE support (Taplo in VS Code)

## Why CX Exists

`cx` exists to provide tooling and standards for AI-driven projects into one unified tool. While it began with a deterministic context bundler, it has evolved into a suite that standardizes how LLMs ingest project context, knowledge, and tools.

Repomix is great for exploratory work: grab a snapshot, feed a prompt, move on.

`cx` solves a different problem. It is for CI/CD, remote runners, scheduled jobs, and any workflow where a bundle created on Monday must still be trustworthy on Friday.

That changes the design:

- Repomix optimizes for flexible packing. `cx` optimizes for deterministic planning.
- Repomix is a rendering engine. `cx` adds planning, manifests, checksums, verification, extraction, and failure semantics around that engine.
- Repomix is the rendering engine. `cx` turns render metadata into a persistent, verifiable artifact contract with immutable manifests and hard-stop invariants.

The strictness is the feature. If a file lands in two sections, if a checksum does not match, or if an extracted file is only approximately recoverable, `cx` makes that visible instead of silently proceeding.

## What You Get

- VCS-driven master file list (git, fossil, hg, or filesystem fallback)
- Section globs as classifiers: they sort tracked files, they cannot add new ones
- Catch-all sections that absorb unmatched files from the VCS master list
- Dirty-state guard: uncommitted modifications block bundling unless `--force` is passed
- Differential `--update` mode that stages in a temporary directory and prunes orphaned bundle artifacts safely
- One rendered output per section
- A shared bundle index artifact for multi-file handover
- Persistent token accounting stored in the manifest
- Optional absolute output spans per file when the active adapter supports them
- SHA-256 checksums for every emitted artifact
- Native shell completions for bash, zsh, and fish
- LLM-friendly output suffixes such as `.xml.txt` and `.json.txt`
- Manifest-aware `inspect`, `list`, `validate`, `verify`, and `extract` commands
- `cx notes` commands for creating notes, listing them, and inspecting backlinks or orphans
- Guided overlap diagnosis and repair with `cx doctor`
- Structured `--json` output across commands for CI integration
- Lock-file capture of behavioral settings, with drift warnings during `verify`

## When To Use It

Use `cx` when you need:

- reproducible context bundles in CI
- persistent token accounting recorded in the manifest for later verification and automation
- downstream tooling that relies on stable manifests and checksums
- a documented recovery path from bundle back to source files
- visible failure states instead of silent best-effort behavior

If you only need a quick local prompt pack, plain Repomix may be the better fit.

## Install

Requirements:

- Node.js `>=25.0.0`

Global install:

```bash
npm install -g @wsmy/cx-cli
```

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

`cx init` writes both `cx.toml` and a `notes/` directory with:

- `notes/README.md` as the repository notes guide
- `notes/template-new-zettel.md` as the atomic note template

The generated notes directory is intentionally part of the repository contract. The idea is to keep architectural intent, implementation decisions, and durable project memory close to the code that depends on them.

### Editor autocomplete and linting

The generated `cx.toml` includes a schema directive for [Taplo](https://taplo.tamasfe.dev/) (the TOML extension in VS Code). This enables real-time autocomplete, validation, and linting:

```toml
#:schema ./schemas/cx-config-v1.schema.json
schema_version = 1
project_name = "myproject"
```

The schema validates structural shape and enum constraints. Runtime validation in `cx load` enforces relational invariants (e.g., catch-all restrictions). See [docs/config-reference.md](docs/config-reference.md#json-schema-for-editor-tooling) for details.

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
| `cx render` | Render planned sections without building a full bundle |
| `cx config show-effective` | Show resolved behavioral settings and their sources |
| `cx completion` | Generate shell completion scripts |
| `cx notes` | Create notes, list them, and inspect note graph relationships |
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
- `cx mcp` starts the CX MCP server using `cx-mcp.toml` when available and falls back to `cx.toml` for the baseline agent profile. The server exposes native file-based `list`, `grep`, and `read` tools over the active workspace scope.
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
target_dir = "{project}-assets"
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
- [Architecture](docs/ARCHITECTURE.md): invariants, manifest model, and rendering pipeline
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

```bash
bun install
bun run format
bun run lint
bun run check
bun run build
bun test tests
```

Full verification:

```bash
bun run verify
```
