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
| `cx bundle <path> [--zip [name]]` | Scan folder, write `manifest.json` + `SHA256SUMS`, optional zip |
| `cx list <repomix-file>` | List file paths in a repomix XML or JSON output |
| `cx repomix [...args]` | Forward arguments directly to the repomix CLI dependency |
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

A Fedora-based devcontainer is available in `.devcontainer/` for IDE-neutral development with Bun.

## License

MIT
