# cx-cli
[![CI](https://github.com/wstein/cx-cli/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/wstein/cx-cli/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/wstein/cx-cli/blob/main/LICENSE)
> ⚠️ Work in progress / playground project. API, defaults, and behavior may change without notice.

`cx` (context) is a repomix umbrella tool for managing **bundles** — folders of repomix output files plus optional binary assets, combined with a manifest and SHA256 checksums.

## Quick start

```bash
bun install -g cx-cli   # once published

# 1. Initialise a project
cx init

# 2. Generate repomix output
cx repomix --output bundles/repomix-output.xml.txt

# 3. Bundle the output
cx bundle ./bundles

# 4. List what's inside a repomix file
cx list bundles/repomix-output.xml.txt

# 5. Clean up generated files
cx cleanup ./bundles --force --zip
```

## Commands

| Command | Description |
|---------|-------------|
| `cx bundle [path] [--zip [name]] [--verbose]` | Scan folder (default current directory), write `manifest.json` + `SHA256SUMS`, optional zip; `--sections` generates repomix outputs from `cx.json` before bundling |
| `cx list <repomix-file>` | List file paths in a bundle directory or repomix output file |
| `cx repomix [...args]` | Forward arguments directly to the repomix CLI dependency |
| `cx repomix-components` | Generate one repomix output file per component from `cx.json` sections |
| `cx init [--ts]` | Create `cx.json`, `repomix.config.json`, and `.repomixignore` scaffolds |
| `cx cleanup <path> [--zip-name \| --all-zips]` | Remove generated bundle artefacts |

## Documentation

See [docs/repomix-bundles.md](docs/repomix-bundles.md) for full documentation.

## Development

```bash
bun install
bun run build   # TypeScript compile
bun run test    # Run the test suite
```

The local CLI shim is implemented in `bin/cx` as a Node-based wrapper. It resolves `dist/index.js` and runs it with Bun if available, otherwise with Node directly, making the package entrypoint platform-neutral. It also automatically rebuilds `dist/index.js` when source files or TypeScript configuration files are newer than the build output.

Use `make rebuild` to force a fresh build, or `make dev` to run the TypeScript compiler in watch mode. Use `make format` or `bun x oxfmt --write .` to format source files.

A Fedora-based devcontainer is available in `.devcontainer/` for IDE-neutral development with Bun.

## License

MIT
