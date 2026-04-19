---
id: 20260419194000
title: Two-Phase Release Protocol
aliases: ["release candidate and finalization protocol", "two-phase release"]
tags: ["release", "workflow", "governance"]
status: current
---
`cx-cli` release management should separate preparation from publication. `develop` prepares the versioned candidate and absorbs release-fix commits until the full CI and release-assurance surface is green. The release tag then finalizes that already-certified commit, verifies that the certified inputs still match the release contract, and publishes npm, GitHub release assets, and Homebrew outputs from the same tarball lineage.

## Links

- [docs/RELEASE_CHECKLIST.md](../docs/RELEASE_CHECKLIST.md)
- [notes/Developer Command Workflow.md](./Developer%20Command%20Workflow.md)
- [notes/GitHub Actions Triggers.md](./GitHub%20Actions%20Triggers.md)
- [[Homebrew Tap Automation]]
- [[v0.4.0 Schema and Release Asset Plan]]
