# cx

`cx` is a deterministic context bundler that plans repository sections, renders one Repomix-compatible output per section, copies selected raw assets, and emits a manifest plus checksum sidecar.

The repository currently implements:

- strict configuration loading and validation
- deterministic file discovery and planning
- Repomix-backed section rendering
- manifest and checksum generation
- lossless `extract` for XML, JSON, Markdown, and Plain bundles created without lossy text transforms
- `init`, `inspect`, `bundle`, `extract`, `list`, `validate`, and `verify`
- lint, build, test, and CI verification workflows

`cx verify` also supports `--against <source-dir>` to compare bundle contents directly against a source tree, with optional `--section` and `--file` filters.
Every command now supports `--json` for CI consumers.
`cx list --json` supports `--section` and `--file` filtering, and `cx extract --json` and `cx validate --json` now emit detailed manifest-aware summaries instead of bare success flags.

Exact output span capture remains unavailable with the current pinned Repomix public API. The tool now reports that limitation explicitly in structured command output instead of fabricating spans.

The implementation intentionally refuses to shell out to `repomix`. The renderer is loaded through a narrow adapter so the rest of the system remains deterministic and testable.

Config path fields such as `source_root` and `output_dir` support `~`, `$VAR`, and `${VAR}` expansion before they are resolved.

## Development

```bash
bun install
bun run format
bun run lint
bun run build
bun test
bun run verify
```
