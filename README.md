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

The implementation intentionally refuses to shell out to `repomix`. The renderer is loaded through a narrow adapter so the rest of the system remains deterministic and testable.

## Development

```bash
bun install
bun run format
bun run lint
bun run build
bun test
bun run verify
```
