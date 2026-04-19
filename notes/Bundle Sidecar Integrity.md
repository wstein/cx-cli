---
id: 20260415162000
aliases: ["SHA-256 sidecars", "bundle integrity"]
tags: [artifact, security, architecture]
status: current
---
`cx` uses SHA-256 sidecars and manifest-level checksums to ensure the integrity of a bundle from the moment it is created until it is extracted or verified.

The integrity model is implemented in `src/manifest/checksums.ts` and `src/manifest/build.ts`.

Key mechanisms:
- **File-Level Hashing**: Every file included in the bundle (both packed text and copied assets) has its SHA-256 hash recorded in the `manifest.json`.
- **Sidecar Sidebars**: A standalone checksum file (e.g., `bundle.sha256`) is generated alongside the bundle artifact. It contains a list of hashes for every file in the bundle directory.
- **Normalization Policy**: To ensure deterministic hashes across platforms, `cx` applies a consistent line-ending normalization before hashing text content.
- **Verification**: The `cx verify` command re-calculates hashes for the bundle files and compares them against the manifest and the sidecar, detecting any silent corruption or unauthorized edits.

This sidecar strategy transforms the bundle into a verifiable unit of work that can be trusted by CI/CD pipelines and AI agents.

## Links

- [[Planning Boundary Enforcement]] - Only files in the master list are hashed.
- [[Bundle Extraction Safety Invariants]] - Verification occurs during extraction to ensure safety.
- src/manifest/checksums.ts - Implementation of the sidecar generation.
- src/manifest/build.ts - Manifest construction with hash records.
