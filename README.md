# cx-cli

**cx** (**c**onte**x**t) is a repomix umbrella CLI for managing multi-file repomix bundles — folders containing repomix output files, binary assets, a manifest, and SHA-256 checksums.

## Installation

```sh
npm install -g cx-cli
```

Or run without installing:

```sh
npx cx-cli <command>
```

## Requirements

- Node.js >= 20

## Quick Start

```sh
# 1. Scaffold config files
cx init

# 2. Generate repomix output
npx repomix

# 3. Bundle the folder (writes manifest.json + SHA256SUMS)
cx bundle ./my-bundle

# 4. List source files inside the repomix output
cx list ./my-bundle

# 5. Clean up generated artefacts
cx cleanup ./my-bundle
```

## Commands

| Command | Description |
|---------|-------------|
| `cx bundle <path>` | Scan a bundle folder and write `manifest.json` + `SHA256SUMS` |
| `cx list <path>` | List source files inside repomix output(s) |
| `cx init` | Scaffold `repomix.config.json` and `cx.json` |
| `cx cleanup <path>` | Remove cx-generated artefacts from a bundle folder |

See [docs/repomix-bundles.md](docs/repomix-bundles.md) for full documentation.

## Programmatic API

```ts
import { scanBundleFolder, writeManifestAndSha, parseRepomixFile, defineConfig } from 'cx-cli';
```

## License

MIT
