---
id: 20260417112000
aliases: ["gha triggers", "ci branch triggers", "workflow triggers"]
tags: ["ci", "github-actions", "workflow"]
---

The CI workflow runs on every branch push and on pull requests, and its verify
job includes coverage. The release and schema publish workflows now run after a
successful CI completion and only proceed when the commit is a version tag or a
manual dispatch asks for one, which keeps publish automation off normal pushes
while the branch feedback loop stays open for feature work and development
branches.

The CI runtime policy declares `BUN_MIN_VERSION=1.3.11` and validates both the
minimum lane and `latest` in the Bun matrix. The release gate also checks
`github.event.workflow_run.conclusion == success` before allowing publish
automation to continue from a CI-triggered run.

## Links

- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `.github/workflows/publish-schemas.yml`
- [[Developer Command Workflow]]
- [[Homebrew Tap Automation]]
- [[Test Strategy Hardening]]
