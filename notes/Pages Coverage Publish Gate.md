---
id: 20260419160500
title: Pages Coverage Publish Gate
aliases: []
tags: [ci, pages, coverage]
---

The public coverage status page should publish from successful `main` CI runs, not from every branch and not only from tagged releases. That gives operators a stable public view of repository health without conflating routine branch activity with release-time asset publishing.

This matters because Pages publishing and release asset publishing solve different problems. Coverage status is a branch-level observability surface, while release assets are immutable tag-level snapshots. One workflow can own both paths only if it keeps the gates separate.

How to apply it:

- publish the unified Pages site when upstream CI concluded with success and the source branch is `main`
- keep release asset mirroring gated by tags or a manual re-finalization of an existing tag
- rebuild coverage inside the Pages publish workflow so the public `/coverage/` path always matches the published site tree
- treat staged-site smoke validation as advisory inside the publish workflow so deploys warn loudly without losing the publish path entirely

## Links

- [.github/workflows/publish-schemas.yml](../.github/workflows/publish-schemas.yml)
- [docs/RELEASE_CHECKLIST.md](../docs/RELEASE_CHECKLIST.md)
- [README.md](../README.md)
- [[Unified Pages Site Assembly]]
- [[Pages Smoke Validation Workflow]]
- [[GitHub Actions Triggers]]
