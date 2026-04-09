# Repomix Bundles

`cx` is a repomix umbrella tool that lets you manage **bundles** — folders containing one or more repomix output files plus optional binary assets — along with a canonical manifest and SHA256 checksums.

---

## Concepts

### Bundle folder

A **bundle folder** is an ordinary directory you pass to `cx bundle`. It may contain:

| File type | Description |
|-----------|-------------|
| `repomix-output.xml` (or `.json`) | Repomix output file(s) |
| Binary / extra assets | Images, PDFs, compiled artefacts, etc. |
| `manifest.json` *(generated)* | Canonical manifest written by `cx bundle` |
| `SHA256SUMS` *(generated)* | GNU sha256sum-compatible checksum file |
| `<name>.zip` *(generated)* | Optional zip archive created with `--zip` |

### manifest.json schema

```jsonc
{
  "format": "cx-bundle-v1",
  "createdAt": "<ISO-8601>",
  "createdBy": "cx-cli",
  "repomixFiles": [
    {
      "path": "repomix-output.xml",   // posix-style relative path
      "size": 123456,                  // bytes
      "lines": 4200,                   // text files only
      "sha256": "<hex>",
      "isBinary": false
    }
  ],
  "assets": [
    {
      "path": "logo.png",
      "size": 8192,
      "sha256": "<hex>",
      "isBinary": true
    }
  ]
}
```

---

## Commands

### `cx bundle <bundle-path> [--zip [name]]`

Scan `<bundle-path>`, compute SHA256 for every file, and write:
- `manifest.json` — structured manifest
- `SHA256SUMS`    — GNU sha256sum-compatible sums

With `--zip` (or `--zip my-archive.zip`) also stream-creates a zip archive.

```bash
cx bundle ./my-bundle
cx bundle ./my-bundle --zip
cx bundle ./my-bundle --zip my-bundle-2024.zip
```

### `cx list <repomix-file>`

Parse a repomix output file (XML or JSON) and print the list of source files it contains.

```bash
cx list ./my-bundle/repomix-output.xml
cx list ./my-bundle/repomix-output.json
```

### `cx init [--ts]`

Initialise a cx project in the current directory. Creates:
- `cx.json` (default) — cx CLI configuration
- `repomix.config.json` — repomix configuration scaffold

Pass `--ts` to create `cx.ts` instead of `cx.json`.

```bash
cx init
cx init --ts
```

### `cx cleanup <bundle-path> [--zip-name <name>] [--all-zips]`

Remove generated artefacts from a bundle folder:
- Always removes: `manifest.json`, `SHA256SUMS`
- `--zip-name <name>` — also remove the named zip
- `--all-zips`        — also remove all `*.zip` files

```bash
cx cleanup ./my-bundle
cx cleanup ./my-bundle --all-zips
cx cleanup ./my-bundle --zip-name my-bundle-2024.zip
```

---

## Installation

```bash
npm install -g cx-cli          # once published to npm
# or
npx cx-cli bundle ./my-bundle  # ad-hoc
```

---

## How to run repomix first

```bash
# 1. Install repomix
npm install -g repomix

# 2. Run repomix in your project
cd my-project
repomix

# 3. Bundle the output
cx bundle .

# 4. List files in the output
cx list repomix-output.xml
```

---

## Usage examples

### Create a bundle with zip

```bash
cx bundle ./docs --zip
# Writes: docs/manifest.json, docs/SHA256SUMS, docs/docs.zip
```

### Inspect what a repomix file contains

```bash
cx list ./docs/repomix-output.xml
# Files in repomix-output.xml (42):
#   src/index.ts
#   src/adapters/repomixAdapter.ts
#   ...
```

### Clean up generated files

```bash
cx cleanup ./docs --all-zips
# Removed from /abs/path/to/docs:
#   manifest.json
#   SHA256SUMS
#   docs.zip
```

---

## Programmatic API

```ts
import {
  scanBundleFolder,
  writeManifestAndSha,
  createZipFromBundleFolder,
  parseRepomixFile,
  cleanupBundleGeneratedFiles,
} from 'cx-cli/adapters/repomixAdapter.js';

// Scan and write manifest
const manifest = await scanBundleFolder('./my-bundle');
await writeManifestAndSha(manifest, './my-bundle');

// Parse repomix XML
const files = await parseRepomixFile('./my-bundle/repomix-output.xml');
console.log(files); // ['src/foo.ts', 'src/bar.ts', ...]

// Create zip
await createZipFromBundleFolder('./my-bundle', './my-bundle/bundle.zip');
```

---

## Recommended follow-ups

- Add token counting integration (repomix `TokenCounter`)
- Support `.repomixignore` / `.cxignore` patterns
- Publish to npm as `cx-cli`
- Add watch mode (`cx bundle --watch`)
- Add JSON Schema validation for `cx.json`
