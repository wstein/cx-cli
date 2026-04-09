# cx-cli

`cx` (context) is a repomix umbrella tool for managing **bundles** — folders of repomix output files plus optional binary assets, combined with a manifest and SHA256 checksums.

## Quick start

```bash
npm install -g cx-cli   # once published

# 1. Initialise a project
cx init

# 2. Generate repomix output
npx repomix

# 3. Bundle the output
cx bundle .

# 4. List what's inside a repomix file
cx list repomix-output.xml

# 5. Clean up generated files
cx cleanup . --all-zips
```

## Commands

| Command | Description |
|---------|-------------|
| `cx bundle <path> [--zip [name]]` | Scan folder, write `manifest.json` + `SHA256SUMS`, optional zip |
| `cx list <repomix-file>` | List file paths in a repomix XML or JSON output |
| `cx init [--ts]` | Create `cx.json` and `repomix.config.json` scaffolds |
| `cx cleanup <path> [--zip-name \| --all-zips]` | Remove generated bundle artefacts |

## Documentation

See [docs/repomix-bundles.md](docs/repomix-bundles.md) for full documentation.

## Development

```bash
npm install
npm run build   # TypeScript compile
npm test        # Jest tests
npm run lint    # Type-check only
```

## License

MIT
