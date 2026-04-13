# CX

`cx` is a deterministic context bundler for teams that need reproducible LLM inputs, not just convenient local packing.

It plans repository sections, renders one Repomix-compatible output per section, copies selected raw assets, and writes a canonical manifest plus SHA-256 checksum sidecar. The result is a bundle that can be verified, inspected, listed, and extracted later without guessing what changed.

## Why CX Exists

Repomix is great for exploratory work: grab a snapshot, feed a prompt, move on.

`cx` solves a different problem. It is for CI/CD, remote runners, scheduled jobs, and any workflow where a bundle created on Monday must still be trustworthy on Friday.

That changes the design:

- Repomix optimizes for flexible packing. `cx` optimizes for deterministic planning.
- Repomix is a rendering engine. `cx` adds planning, manifests, checksums, verification, extraction, and failure semantics around that engine.
- Repomix is the rendering engine. `cx` turns render metadata into a persistent, verifiable bundle contract with immutable manifests and hard-stop invariants.

The strictness is the feature. If a file lands in two sections, if a checksum does not match, or if an extracted file is only approximately recoverable, `cx` makes that visible instead of silently proceeding.

## What You Get

- VCS-driven master file list (git, fossil, or filesystem fallback)
- Section globs as classifiers: they sort tracked files, they cannot add new ones
- Catch-all sections that absorb unmatched files from the VCS master list
- Dirty-state guard: uncommitted modifications block bundling unless `--force` is passed
- One Repomix-compatible render per section
- A shared bundle index artifact for multi-file handover
- Persistent token accounting stored in the manifest
- Optional absolute output spans per file when the active adapter supports them
- SHA-256 checksums for every emitted artifact
- Manifest-aware `inspect`, `list`, `validate`, `verify`, and `extract` commands
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
node bin/cx.js --help
```

## Quick Start

Initialize a starter config:

```bash
cx init --name demo
```

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

`--update` stages artifacts in a temporary directory, then syncs into `output_dir`.
Pruning is safety-gated: `cx` refuses to prune if the target directory does not
look like an existing bundle directory.

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

## Command Overview

| Command | Purpose |
| --- | --- |
| `cx init` | Create a starter `cx.toml` |
| `cx inspect` | Show the computed plan without writing files |
| `cx bundle` | Build a deterministic bundle directory |
| `cx list` | List bundle contents grouped by section |
| `cx validate` | Validate bundle structure and schema |
| `cx verify` | Verify bundle integrity and optional source-tree drift |
| `cx extract` | Restore files from a bundle |
| `cx doctor overlaps` | Diagnose section overlap conflicts |
| `cx doctor fix-overlaps` | Generate or apply exact exclude fixes |
| `cx render` | Render planned sections without building a full bundle |
| `cx config show-effective` | Show resolved behavioral settings and their sources |
| `cx completion` | Generate shell completion scripts |
| `cx adapter ...` | Inspect Repomix adapter capabilities and compatibility |

Every command supports `--json` for machine consumption.

## Shell Completions

Generate and install completion scripts:

```bash
# bash
cx completion --shell=bash >> ~/.bashrc

# zsh
cx completion --shell=zsh >> ~/.zshrc

# fish
cx completion --shell=fish > ~/.config/fish/completions/cx.fish
```

Open a new shell session after installation.

> For even faster discoverability, see the `cx inspect --token-breakdown` example in the Quick Start section above.

## The Important Failure Model

Some constraints are non-negotiable:

- section overlap is a hard failure when `dedup.mode = "fail"`; this is the default
- asset collisions are hard failures
- missing core adapter contract is a hard failure
- degraded extraction is blocked unless you explicitly pass `--allow-degraded`

This is intentional. `cx` is designed to stop a pipeline before a bad bundle turns into a harder-to-debug downstream failure. For packed text files, the bundle hash tracks the normalized Repomix output, so `verify` and `extract` stay aligned with the actual handover payload instead of source-byte exactness.

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
exclude = [".git/**", "node_modules/**", "dist/**", "tmp/**", "bun.lock"]
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
include = ["README.md", "docs/**", "*.md"]
exclude = []

[sections.repo]
include = [
  ".gitignore",
  ".github/workflows/ci.yml",
  "biome.json",
  "bin/cx.js",
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
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md): project planning notes
- [Spec Debate](docs/SPEC_DEBATE.md): design discussion and tradeoffs

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
