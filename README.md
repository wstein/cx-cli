# cx

`cx` is a deterministic context bundler that plans repository sections, renders one Repomix-compatible output per section, copies selected raw assets, and emits a manifest plus checksum sidecar. The manifest uses standard JSON object arrays for section file metadata, keeping downstream consumption straightforward.

The repository currently implements:

- strict configuration loading and validation
- deterministic file discovery and planning
- Repomix-backed section rendering
- manifest and checksum generation
- manifest-verified `extract` for XML, JSON, Markdown, and Plain bundles, with explicit opt-in for degraded restores
- section-grouped `list` output with per-file status visibility
- manifest-stored source `time` metadata restored during extraction
- `init`, `inspect`, `bundle`, `extract`, `list`, `validate`, `verify`, `render`, and `doctor` commands
- `adapter` diagnostic namespace for Repomix integration inspection
- lint, build, test, and CI verification workflows

`cx verify` also supports `--against <source-dir>` to compare bundle contents directly against a source tree, with optional `--section` and `--file` filters.
`cx verify --json` emits structured error payloads with failure type classification (checksum_omission, checksum_mismatch, source_tree_drift, unexpected_checksum_reference), enabling CI to distinguish and handle different verification failure modes.

`cx render` renders planned sections as standard Repomix output without requiring a full bundle. Use `--section`, `--all-sections`, or `--file` to select sections or specific files, with `--style` to override output format and `--json` for metadata.

`cx doctor` exposes config-recovery workflows for section overlap conflicts:
- `overlaps`: Diagnose every conflicted path, the matching sections, and the recommended owner.
- `fix-overlaps`: Generate or apply exact `sections.<name>.exclude` entries, with `--dry-run` for CI output and `--interactive` for guided ownership choices.

`cx extract` treats the manifest as the source of truth for recovery. `intact` files extract by default, `copied` assets restore directly from stored bundle content, and `degraded` files require `--allow-degraded` before `cx` will write them back out. When extraction succeeds, `cx` also restores the original source `time` recorded in the manifest.

`cx adapter` exposes Repomix integration diagnostics via three subcommands:
- `capabilities`: Show cx and Repomix versions, supported output styles, and exact span support status.
- `inspect`: Show the exact file selection and Repomix adapter inputs for a planned render.
- `doctor`: Run adapter compatibility and runtime sanity checks.

Every command supports `--json` for CI consumers.
`cx list --json` supports `--section` and `--file` filtering, reports per-file status, and uses manifest-recorded `time` plus manifest-recorded list display settings, including the configured grayscale `time_palette`. Human `cx inspect` and `cx inspect --json` both annotate planned files with bundle-side status whenever a matching bundle already exists. `cx extract --json` emits dedicated failure payloads that identify the exact file or files blocked by degraded or missing reconstructed content. `cx validate --json` emits detailed manifest-aware summaries instead of bare success flags.
`cx verify` now fails if the checksum file omits any expected manifest, section-output, or asset entry.
Bundle loading requires exactly one `*-manifest.json` file, and `cx init --name` now enforces the same safe project-name rules as config loading.

When `manifest.include_output_spans = true`, `cx bundle` records `output_start_line` / `output_end_line` as absolute line numbers in each section output file whenever the active adapter exposes `renderWithMap`. Wrapper markup is never counted as part of a file's span, but wrapper lines that appear before a file still shift that file's absolute start line. If the adapter can render but cannot capture exact spans, bundling continues with a clear warning and the span fields remain `null`.

The implementation intentionally refuses to shell out to `repomix`. The renderer is loaded through a narrow adapter so the rest of the system remains deterministic and testable. Adapter compatibility is checked against the public exports we actually call, rather than inferred from package-layout assumptions. Core rendering only requires `mergeConfigs` plus either `packStructured()` or `pack()`. Exact span capture remains optional.

Config path fields such as `source_root` and `output_dir` support `~`, `$VAR`, and `${VAR}` expansion before they are resolved. Exact token counting is configurable through `[tokens]` via Repomix tokenizer encodings, and `cx list` temperature thresholds plus its grayscale time palette are configurable through `[display.list]`.

For safe configuration patterns and bundle invariants, see `docs/config-reference.md`.

## Development

```bash
bun install
bun run format
bun run lint
bun run build
bun test
bun run verify
```
