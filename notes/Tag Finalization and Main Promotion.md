---
id: 20260419195000
title: Tag Finalization and Main Promotion
aliases: ["tag finalization", "main fast-forward promotion"]
tags: ["release", "tag", "main"]
target: current
---
The release tag should finalize the certified candidate commit rather than start a fresh untrusted rebuild story. After the release workflow verifies version, CI, and tarball consistency and then publishes the release payload, `main` should move to the shipped commit by fast-forward so branch history mirrors the exact released state without a rebase step.

## Links

- [docs/modules/ROOT/pages/manual/release-and-integrity.adoc](../docs/modules/ROOT/pages/manual/release-and-integrity.adoc)
- [.github/workflows/release.yml](../.github/workflows/release.yml)
- [[Two-Phase Release Protocol]]
- [[GitHub Actions Triggers]]
