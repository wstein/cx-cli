---
id: 20260417112000
aliases: ["gha triggers", "ci branch triggers", "workflow triggers"]
tags: ["ci", "github-actions", "workflow"]
---

The CI workflow runs on every branch push and on pull requests, but not on
`v*` tag pushes. Tag finalization belongs to the release workflow instead of
the main CI pipeline. Pages publishes the unified `/schemas/` and `/coverage/`
site from successful `main` runs, while release publishing starts from a
`vX.Y.Z` tag and then proves that the tagged commit already passed the normal
`develop` CI path before it will ship anything. That keeps normal branch
feedback fast without re-running the full CI pipeline during release
finalization.

The CI runtime policy declares `BUN_MIN_VERSION=1.3.11` and validates both the
minimum lane and `latest` in the Bun matrix. The Pages publish gate checks
`github.event.workflow_run.conclusion == success` and
`github.event.workflow_run.head_branch == main`, while the release workflow
checks the GitHub Actions API for a successful `CI` run on `develop` for the
exact tagged commit before it publishes npm, GitHub assets, or Homebrew state.

Release triggering now follows a two-phase rule: `develop` carries the versioned
release candidate and absorbs fix-forward release commits, while the `vX.Y.Z`
tag is the finalization signal for the exact certified candidate commit. After
that publish succeeds, the release workflow should fast-forward `main` to the
released commit so the branch mirrors the shipped state instead of replaying it
through a rebase.

## Links

- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `.github/workflows/publish-schemas.yml`
- [[Two-Phase Release Protocol]]
- [[Release Candidate on Develop]]
- [[Tag Finalization and Main Promotion]]
- [[Unified Pages Site Assembly]]
- [[Developer Command Workflow]]
- [[Homebrew Tap Automation]]
- [[Test Strategy Hardening]]
