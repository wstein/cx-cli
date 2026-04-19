---
id: 20260417112000
aliases: ["gha triggers", "ci branch triggers", "workflow triggers"]
tags: ["ci", "github-actions", "workflow"]
---

The CI workflow runs on every branch push and on pull requests, and its verify
job includes coverage. The release and Pages publish workflows now run after a
successful CI completion, but they do not share the same gate: Pages publishes
the unified `/schemas/` and `/coverage/` site from successful `main` runs,
while release asset mirroring still waits for a version tag or an explicit
manual dispatch. That keeps normal branch feedback fast without mixing routine
Pages refreshes with release publishing.

The CI runtime policy declares `BUN_MIN_VERSION=1.3.11` and validates both the
minimum lane and `latest` in the Bun matrix. The release and Pages gates both
check `github.event.workflow_run.conclusion == success` before allowing publish
automation to continue from a CI-triggered run, and the Pages path also checks
`github.event.workflow_run.head_branch == main`.

## Links

- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `.github/workflows/publish-schemas.yml`
- [[Unified Pages Site Assembly]]
- [[Developer Command Workflow]]
- [[Homebrew Tap Automation]]
- [[Test Strategy Hardening]]
