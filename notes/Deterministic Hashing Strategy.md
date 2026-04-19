---
id: 20260415164000
aliases: ["normalization policy", "deterministic hashes"]
tags: [artifact, hashing, determinism]
status: current
---
`cx` computes deterministic hashes for bundle files so that identical content produces identical bundle artifacts across platforms.

The hashing strategy is implemented in `src/manifest/checksums.ts` and used by the bundle building and verification pipeline.

Key principles:
- **Stable representation**: Text content is normalized consistently before hashing so line endings, platform differences, and metadata ordering do not introduce nondeterminism.
- **Explicit file ordering**: The checksum sidecar sorts relative paths lexically before writing hash entries.
- **Separate asset and text hashes**: Both packed text files and copied assets have SHA-256 hashes recorded in the manifest, but asset storage and text normalization paths are handled separately.
- **Manifest inclusion**: The manifest stores SHA-256 for every file entry so downstream verification can compute and compare expected values.
- **Verification on restoration**: `cx extract --verify` re-hashes restored files and compares them against the recorded values to detect corruption.

This strategy makes the bundle a verifiable, reproducible artifact rather than a best-effort snapshot.

## Links

- [[Bundle Sidecar Integrity]] - The sidecar output is the hash ledger for the bundle.
- [[Bundle Extraction Safety Invariants]] - Extraction verification uses these deterministic hashes.
- src/manifest/checksums.ts - Hash generation and parsing implementation.
- src/manifest/build.ts - Manifest records the hashes for each file.
