---
id: 20260417112000
aliases: ["gha triggers", "ci branch triggers", "workflow triggers"]
tags: ["ci", "github-actions", "workflow"]
---

The CI workflow runs on every branch push and on pull requests, and its verify
job now includes coverage. The release workflow stays tag-driven and runs as a
single publish job. That keeps the
branch feedback loop wide enough for feature work and development branches
without turning release automation loose on normal pushes.

## Links

- `.github/workflows/ci.yml`
- `.github/workflows/publish.yml`
- `.github/workflows/publish-schemas.yml`
