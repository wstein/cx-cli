---
id: 20260415162500
aliases: ["safe extraction", "recovery invariants"]
tags: [extract, recovery, architecture]
target: current
---
`cx` restoration ensures that files extracted from a bundle are exactly as they were captured during the planning phase, preventing degraded or corrupted files from entering a project.

The extraction logic is implemented in `src/extract/extract.ts` and `src/extract/resolution.ts`.

Key mechanisms:
- **Manifest-Guided Restoration**: `extractBundle` uses the `manifest.json` as the source of truth for file properties (line spans for text, stored paths for assets).
- **Collision Protection**: `assertWritable` prevents accidental overwriting of existing files unless the `--overwrite` flag is explicitly set.
- **Timestamp Preservation**: The `restoreMtime` function uses the original modification time from the manifest to preserve file history on Disk.
- **Integrity Validation**: When the `--verify` flag is provided, `cx` re-hashes each extracted file to ensure it matches the recorded `sha256` from the manifest.
- **Asset/Text Distinction**: The extraction logic correctly routes files based on their manifest `kind`, using either local file copies (for assets) or line-anchored reads from the packed bundle (for text sections).

These invariants ensure that a `cx extract` operation is a high-fidelity restoration of the original repository state as recorded in the bundle.

## Links

- [[Bundle Sidecar Integrity]] - Hashes from the manifest drive the extraction verification.
- [[Section Ownership and Overlaps]] - Manifest-side sections guide the selection of files to extract.
- src/extract/extract.ts - Implementation of the bundle extraction logic.
- src/extract/resolution.ts - Logic for resolving file and asset paths for extraction.
