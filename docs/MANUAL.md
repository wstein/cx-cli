# CX Operator Manual

## Who This Manual Is For

This guide is for engineers running `cx` as an operational tool: local bundle authors, CI maintainers, and remote-runner owners.

If you are new to the project, read the README first. If you need the invariants and internal model, read [Architecture](ARCHITECTURE.md). If you need the detailed knobs, read [Configuration Reference](config-reference.md).

## Mental Model

`cx` is a pipeline, not just a formatter:

1. Load and validate `cx.toml`.
2. Build a deterministic plan of text files, sections, and copied assets.
3. Render each section through the Repomix adapter.
4. Write a canonical manifest, a lock file, and a SHA-256 checksum sidecar.
5. Let downstream tools inspect, verify, list, or extract from that recorded state.

The bundle is the deliverable. The manifest is the source of truth for what the bundle means.

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
| `cx doctor overlaps` | A plan fails because one file matches multiple sections |
| `cx doctor fix-overlaps` | You want exact exclude entries generated or applied |

## Standard Workflow

### 1. Create or inspect config

```bash
cx init --name demo
cx inspect --config cx.toml
```

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

- `docs` for human-facing documentation and root markdown
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

## Workflow: Safe CI Operation

For automated pipelines, prefer strict mode:

```bash
CX_STRICT=true cx bundle --config cx.toml
cx verify dist/myproject-bundle --against . --config cx.toml
```

This forces all Category B behaviors to fail, not warn. That matters because warning-only behavior is easy to miss in logs and can otherwise drift into production habits.

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

## Recommended Reading Order

1. README
2. This manual
3. [Architecture](ARCHITECTURE.md)
4. [Extraction Safety](EXTRACTION_SAFETY.md)
5. [Configuration Reference](config-reference.md)
