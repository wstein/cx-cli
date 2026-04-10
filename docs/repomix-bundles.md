# Repomix Bundles

A **repomix bundle** is a self-describing directory that collects one or more repomix output files together with binary assets, a SHA-256 checksum manifest, and an index file (`manifest.json`).

## Concepts

| Term | Description |
|---|---|
| **Bundle directory** | The root folder that holds all bundle content. |
| **Repomix file** | A repomix output file (`repomix-output.xml.txt`, `repomix-output.json`, etc.) packed into the bundle. |
| **Binary asset** | Any non-text file that is part of the bundle (images, fonts, compiled artefacts, …). |
| `SHA256SUMS` | GNU-compatible SHA-256 checksum file for all data files in the bundle. |
| `manifest.json` | JSON index that records the path, size, SHA-256 hash, and type of every file in the bundle. |

## Quick Start

```bash
# 1. Initialise project configuration
cx init

# 2. Run repomix to produce output
cx repomix --output bundles/repomix-output.xml.txt

# 3. Process the bundle directory
cx bundle ./bundles

# 4. List the bundle contents
cx list ./bundles

# 5. Inspect a specific repomix output file
cx list ./bundles/repomix-output.xml.txt --verbose

# 6. Clean up generated metadata
cx cleanup ./bundles --force
```

## Commands

### `cx bundle [path]`

Scan a directory (defaults to the current working directory or `bundle.outputDir` from `cx.json` when configured), compute SHA-256 for every file, and write `SHA256SUMS` and `manifest.json`.

```
cx bundle [path] [options]

Options:
  --zip                  Create a ZIP archive of the completed bundle
  --zip-output <path>    Output path for the ZIP archive (implies --zip)
  --exclude <pattern>    Glob pattern to exclude; may be repeated
  --verbose              Print detailed bundle diagnostics
  --sections             Generate repomix outputs from cx.json before bundling
  --cx-config <path>     CX configuration file (default: cx.json)
  --repomix-config <path>
                         Repomix configuration file
  --section-checksum-file <path>
                         Checksum file for generated section outputs
  --section-verbose      Print verbose repomix section generation output
```

Notes:
- If `cx.json` contains `sections` and no explicit bundle path is provided, repomix section outputs are generated automatically.
- Component outputs are regenerated only when section source files or relevant config files have changed since the last generation.

### `cx repomix [...args]`

Forward all arguments directly to the repomix CLI dependency.

This command does not interpret repomix-specific flags itself. It forwards the arguments
unchanged to the local `repomix` binary that is installed as a dependency of `cx-cli`.

```
cx repomix --output bundles/repomix-output.xml.txt
cx repomix --help
```

### `cx verify [path]`

Verify a bundle directory by checking that `manifest.json` and `SHA256SUMS` are present and consistent.

This command performs the following checks:

- `manifest.json` parses successfully and contains a file index
- `SHA256SUMS` is present and parseable
- each manifest file record has a matching checksum entry in `SHA256SUMS`
- each recorded data file hashes to the expected SHA-256 value
- `manifest.json` records the correct SHA-256 hash for `SHA256SUMS`

```
cx verify ./bundles
cx verify --cx-config ./cx.json
```

Use this command when you want `cx` to manage repomix invocation while preserving the
full repomix CLI surface.

### `cx list <path>`

**Example:**

```bash
cx bundle ./my-bundle
cx bundle ./my-bundle --zip
cx bundle ./my-bundle --zip --zip-output ./dist/bundle.zip
cx bundle ./my-bundle --exclude "**/*.log" --exclude "**/tmp/**"
```

**Output files created:**

| File | Description |
|---|---|
| `manifest.json` | JSON index of every file in the bundle. |
| `SHA256SUMS` | GNU sha256sum-compatible checksums for every data file. |
| `<dir>.zip` | Optional ZIP archive (when `--zip` is passed). |

### `cx list <path>`

List the contents of a bundle directory or the source-file entries inside a repomix output file.

When a bundle contains `repomix-component-*` section outputs generated from `cx.json`, `cx list` groups those files by section name and expands each section file into its contained source-file entries.

The parser is robust to component-style repomix outputs that include raw source text with XML-like characters (for example, `a < b` or HTML fragments).

```
cx list <path> [options]

Options:
  --verbose   Show SHA-256 digests, sizes, and line counts
```

**Examples:**

```bash
# List all files in a bundle
cx list ./my-bundle

# List source files packed inside a specific repomix output
cx list ./my-bundle/repomix-output.xml.txt

# Show full details
cx list ./my-bundle --verbose
```

### `cx init`

Create default configuration files in the current directory (or a specified directory).

```
cx init [options]

Options:
  --cwd <path>   Target directory (defaults to process.cwd())
  --ts           Generate a `tsconfig.json` file for TypeScript projects
```

Creates:

- **`cx.json`** — cx CLI configuration (output style, bundle directory, zip settings)
- **`repomix.config.json`** — repomix configuration (output file path, parsable style, security checks)
- **`.repomixignore`** — ignore rules for repomix input scanning

Both files are skipped without error if they already exist, making `cx init` safe to re-run.

### `cx cleanup <path>`

Remove generated metadata files from a bundle directory.

```
cx cleanup <path> [options]

Options:
  --force   Perform the deletion (default: dry run)
  --zip     Also remove ZIP archives found in the bundle directory
```

Without `--force`, the command performs a **dry run** — it lists the files that would be removed without touching the file system.

```bash
# Preview what would be removed
cx cleanup ./my-bundle

# Actually remove manifest.json and SHA256SUMS
cx cleanup ./my-bundle --force

# Also remove ZIP archives
cx cleanup ./my-bundle --force --zip
```

## File Formats

### `manifest.json`

```json
{
  "schemaVersion": "1",
  "createdAt": "2024-01-15T12:00:00.000Z",
  "bundlePath": "/absolute/path/to/bundle",
  "files": [
    {
      "path": "repomix-output.xml.txt",
      "size": 204800,
      "sha256": "a1b2c3d4...",
      "type": "repomix"
    },
    {
      "path": "assets/logo.png",
      "size": 12345,
      "sha256": "e5f6a7b8...",
      "type": "binary"
    },
    {
      "path": "SHA256SUMS",
      "size": 134,
      "sha256": "deadbeef...",
      "type": "checksum"
    }
  ]
}
```

**File types:**

| Type | Description |
|---|---|
| `repomix` | A repomix output file detected via content or file extension. |
| `binary` | A binary asset (image, font, archive, etc.). |
| `manifest` | The `manifest.json` file itself. |
| `checksum` | The `SHA256SUMS` file. |

### `SHA256SUMS`

Standard GNU sha256sum format — one line per data file, two spaces between digest and path:

```
a1b2c3d4e5f6...  repomix-output.xml.txt
deadbeef1234...  assets/logo.png
```

Verify with the standard tool:

```bash
cd ./my-bundle && sha256sum --check SHA256SUMS
```

## Configuration

### `cx.json`

```json
{
  "$schema": "https://raw.githubusercontent.com/wstein/cx-cli/main/schemas/cx.schema.json",
  "version": "1",
  "repomix": {
    "configFile": "repomix.config.json",
    "outputStyle": "xml",
    "outputDir": "bundles"
  },
  "bundle": {
    "outputDir": "bundles",
    "createZip": false
  }
}
```

### `repomix.config.json`

```json
{
  "$schema": "https://repomix.com/schemas/latest/schema.json",
  "output": {
    "filePath": "repomix-output.xml.txt",
    "style": "xml",
    "parsableStyle": true,
    "fileSummary": true,
    "directoryStructure": true
  },
  "ignore": {
    "useGitignore": true,
    "useDefaultPatterns": true,
    "customPatterns": []
  },
  "security": {
    "enableSecurityCheck": true
  }
}
```

> **Tip:** Set `parsableStyle: true` in the repomix config to produce machine-readable XML that `cx list` can parse to enumerate individual source-file entries.

## Programmatic API

All commands are thin wrappers around the functions exported by `src/adapters/repomixAdapter.ts`. You can import and call these directly:

```typescript
import {
  processBundle,
  readManifest,
  parseRepomixFile,
  computeSha256,
} from 'cx-cli/dist/adapters/repomixAdapter.js';

// Process a bundle directory
const manifest = await processBundle('./my-bundle', { createZip: true });

// Read an existing manifest
const existing = await readManifest('./my-bundle');

// Parse entries from a repomix output file
const parsed = await parseRepomixFile('./my-bundle/repomix-output.xml.txt');
for (const entry of parsed.entries) {
  console.log(entry.path, entry.content.length, 'chars');
}
```

## Architecture

```
cx-cli/
├── src/
│   ├── index.ts                     # CLI entry point (yargs)
│   ├── adapters/
│   │   └── repomixAdapter.ts        # Core: scan, hash, parse, zip
│   ├── commands/
│   │   ├── bundle.ts                # cx bundle
│   │   ├── list.ts                  # cx list
│   │   ├── init.ts                  # cx init
│   │   └── cleanup.ts               # cx cleanup
│   └── cli/
│       └── repomix-commands.ts      # yargs command registration
└── docs/
    └── repomix-bundles.md           # This file
```

## Design Decisions

- **Deterministic ordering** — All file lists are sorted lexicographically before hashing and writing, ensuring that the same directory always produces the same `manifest.json` and `SHA256SUMS`.
- **Streaming SHA-256** — Large files are hashed via Node.js streams rather than reading the entire file into memory.
- **Stale repomix section generation** — Component outputs are regenerated only when section sources, `cx.json`, or `repomix.config.json` change.
- **CLI implementation** — The command parser is implemented with `yargs`, not `cac`, to match the current codebase.
- **Streaming ZIP** — The `archiver` library streams files into the ZIP archive without buffering the full archive in RAM.
- **No circular hashes** — `SHA256SUMS` contains hashes for data files only. `manifest.json` contains the hash of `SHA256SUMS`. There is no circular dependency.
- **Idempotent `cx init`** — Configuration files are never overwritten; re-running `cx init` is safe.
- **Dry-run `cx cleanup`** — Without `--force`, cleanup only lists what would be removed, preventing accidental data loss.
