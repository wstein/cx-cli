# cx

`cx` is a deterministic context bundler that plans repository sections, renders one Repomix-compatible output per section, copies selected raw assets, and emits a manifest plus checksum sidecar.

The repository currently implements:

- strict configuration loading and validation
- deterministic file discovery and planning
- Repomix-backed section rendering
- manifest and checksum generation
- lossless `extract` for XML, JSON, Markdown, and Plain bundles created without lossy text transforms
- `init`, `inspect`, `bundle`, `extract`, `list`, `validate`, `verify`, and `render` commands
- `adapter` diagnostic namespace for Repomix integration inspection
- lint, build, test, and CI verification workflows

`cx verify` also supports `--against <source-dir>` to compare bundle contents directly against a source tree, with optional `--section` and `--file` filters.
`cx verify --json` emits structured error payloads with failure type classification (checksum_omission, checksum_mismatch, source_tree_drift, unexpected_checksum_reference), enabling CI to distinguish and handle different verification failure modes.

`cx render` renders planned sections as standard Repomix output without requiring a full bundle. Use `--section`, `--all-sections`, or `--file` to select sections or specific files, with `--style` to override output format and `--json` for metadata.

`cx adapter` exposes Repomix integration diagnostics via three subcommands:
- `capabilities`: Show cx and Repomix versions, supported output styles, and exact span support status.
- `inspect`: Show the exact file selection and Repomix adapter inputs for a planned render.
- `doctor`: Run adapter compatibility and runtime sanity checks.

Every command supports `--json` for CI consumers.
`cx list --json` supports `--section` and `--file` filtering, and `cx extract --json` and `cx validate --json` now emit detailed manifest-aware summaries instead of bare success flags.
`cx verify` now fails if the checksum file omits any expected manifest, section-output, or asset entry.
Bundle loading requires exactly one `*-manifest.toon` file, and `cx init --name` now enforces the same safe project-name rules as config loading.

Exact output span capture remains unavailable with the current pinned Repomix public API. The tool now reports that limitation explicitly in structured command output instead of fabricating spans.

When `manifest.include_output_spans = true`, `cx bundle` uses Repomix structured rendering to preserve standard Repomix XML output style and to emit `output_start_line` / `output_end_line` for files in the manifest.

The implementation intentionally refuses to shell out to `repomix`. The renderer is loaded through a narrow adapter so the rest of the system remains deterministic and testable. Adapter compatibility is checked against the public exports we actually call, rather than inferred from package-layout assumptions.

Config path fields such as `source_root` and `output_dir` support `~`, `$VAR`, and `${VAR}` expansion before they are resolved.

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
