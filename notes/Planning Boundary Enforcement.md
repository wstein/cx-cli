---
id: 20260415161000
aliases: ["boundary enforcement", "planning rules"]
tags: [planning, safety, architecture]
status: current
---
`cx` enforces a strict repository boundary during bundle planning and live MCP sessions. This prevents sensitive files from leaking into the agent context or the final bundle.

The planning boundary is implemented in the `buildMasterList` function in `src/planning/masterList.ts`.

Key mechanisms:
- **VCS-First Discovery**: The master file list starts with the files tracked by the version control system (Git, Fossil, etc.).
- **Global Config Overrides**:
  - `[files].include`: Explicitly adds non-VCS-tracked files (like documentation or generated build artifacts) to the pool.
  - `[files].exclude`: Unconditionally strips files from the master list **before** any section classification begins. This acts as a security override.
- **Output Protection**: The output directory (`config.outputDir`) is automatically excluded from the master list to prevent self-referential bundles.
- **Subpath Validation**: Files outside the source root are ignored, ensuring the agent and the bundle stay scoped to the repository.

This multi-stage filtering ensures that the "master list" is the only pool of files available for section sorting and tool access.

The same boundary rules apply whether the workspace is being prepared for
Track A bundle creation or for Track B live MCP exploration. See
[[Operational Bifurcation]].

## Links

- [[VCS Master Base]] - The source of the initial file pool.
- [[Section Ownership and Overlaps]] - How the filtered master list is distributed.
- src/planning/masterList.ts - Implementation of the boundary enforcement.
