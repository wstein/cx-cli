---
id: 20260417112000
aliases: ["gha triggers", "ci branch triggers", "workflow triggers"]
tags: ["ci", "github-actions", "workflow"]
---

The CI workflow runs on every branch push and on pull requests, and its verify
job includes coverage. The release workflow stays tag-driven, which keeps
release automation off normal pushes while the branch feedback loop stays open
for feature work and development branches.

## Links

- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `.github/workflows/publish-schemas.yml`
