# Repomix Bundles — Zettel Note

**ID:** 20260409-repomix-bundles
**Created:** 2026-04-09
**Tags:** #cx-cli #repomix #bundles #tooling

---

## Summary

`cx-cli` provides a thin adapter layer on top of repomix that adds bundle management:
- A **bundle folder** groups one or more repomix output files with optional binary assets.
- The adapter computes streaming SHA256 checksums and writes `manifest.json` + `SHA256SUMS`.
- Optional zip creation for distribution.
- CLI commands: `bundle`, `list`, `init`, `cleanup`.

## Key design decisions

- **Deterministic ordering**: file entries in the manifest and SHA256SUMS are always sorted by posix path.
- **Streaming I/O**: SHA256 hashing and zip creation use Node streams (no full buffering).
- **No repomix dependency at runtime**: the adapter uses `fast-xml-parser` and native JSON.parse to read repomix outputs; repomix itself is not a runtime dependency.
- **ESM + Node 20+**: all files use ES module syntax (`import`/`export`).
- **kleur in commands, not adapter**: the adapter is pure logic; colours live only in command handlers.

## Files

| File | Role |
|------|------|
| `src/adapters/repomixAdapter.ts` | Core logic: scan, hash, manifest, zip, parse, cleanup |
| `src/commands/bundle.ts` | `cx bundle` handler |
| `src/commands/list.ts` | `cx list` handler |
| `src/commands/init.ts` | `cx init` handler |
| `src/commands/cleanup.ts` | `cx cleanup` handler |
| `src/cli/repomix-commands.ts` | cac registration + framework-agnostic note |
| `src/cli/index.ts` | CLI entry point |
| `docs/repomix-bundles.md` | End-user documentation |

## Dependencies added

| Package | Use |
|---------|-----|
| `fast-xml-parser` | Parse repomix XML output files |
| `archiver` | Streaming zip creation |
| `fast-glob` | Recursive file scanning |
| `kleur` | ANSI colours in command output |
| `cac` | CLI argument parsing |

## How to test

```bash
npm run build              # compile TypeScript
node dist/cli/index.js --help
node dist/cli/index.js init
node dist/cli/index.js bundle . --zip
node dist/cli/index.js list repomix-output.xml
node dist/cli/index.js cleanup . --all-zips
```

## Links

- [repomix](https://github.com/yamadashy/repomix)
- [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser)
- [archiver](https://github.com/archiverjs/node-archiver)
- [fast-glob](https://github.com/mrmlnc/fast-glob)
