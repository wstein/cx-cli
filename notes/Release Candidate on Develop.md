---
id: 20260419194500
title: Release Candidate on Develop
aliases: ["develop release candidate", "version bump starts release"]
tags: ["release", "develop", "ci"]
status: current
---
The `package.json` version bump on `develop` should be the start of the release, not the end of it. That commit marks the release candidate, after which the repo stays on `develop` for fix-forward release work until the normal CI, release-assurance, and artifact lanes are all green for that exact candidate lineage.

## Links

- [docs/RELEASE_CHECKLIST.md](../docs/RELEASE_CHECKLIST.md)
- [package.json](../package.json)
- [.github/workflows/ci.yml](../.github/workflows/ci.yml)
- [[Two-Phase Release Protocol]]
- [[Developer Command Workflow]]
