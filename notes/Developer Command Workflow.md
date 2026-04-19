---
id: 20260417105501
aliases: ["make workflow", "developer commands", "release workflow"]
tags: ["workflow", "development", "release"]
---

`make test` is the fast local feedback loop, `make verify` is the normal
pre-merge gate, and `make release VERSION=x.y.z` is the repository-local
two-phase release wizard. Keeping those roles separate keeps the common command
quick while making the release path explicit and repeatable.

- The `Makefile` delegates to `package.json` scripts using 1:1 shell shim wrappers.

## Release candidate protocol

- Releases are prepared on `develop`.
- Bumping `package.json` to the target version starts the release candidate.
- `make verify` is the normal fix-forward loop while the candidate is still moving.
- `make certify` is the pre-tag proof gate for the exact candidate commit.
- The first `make release VERSION=x.y.z` call with a new version starts the candidate by updating the version files, committing, and pushing `develop`.
- The second `make release VERSION=x.y.z` call with that same version creates and pushes the `vX.Y.Z` tag.
- The `vX.Y.Z` tag is the finalization action. It should be created only after the `develop` candidate commit is green.
- After publish succeeds, `main` should fast-forward to the released commit so the branch reflects the shipped history exactly.

## Testing and coverage conventions

- `package.json` does not define a single generic `coverage` task; the
  authoritative coverage lane is explicit.
- The dedicated Vitest coverage lane is `bun run ci:test:coverage`; it runs the shared repository suite natively under Vitest, then produces `coverage/vitest/coverage-summary.json`, HTML output, LCOV, and `.ci/coverage-summary.md`.
- The focused MCP debugging lane is `bun run test:vitest:mcp`; it keeps MCP-heavy server, CLI, audit, and policy tests separate from the broad repository coverage run.
- `bun run test:vitest:mcp:ui` opens the same MCP lane in Vitest UI so operators can rerun failures interactively and inspect coverage or import-graph cost inside the MCP stack.
- The default test task runs the fast Vitest unit suite.
- `bun run test:bun:regression` runs the Bun-only runtime regression lane that
  CI uses for real Bun runtime proof over bundle, CLI, MCP, and Repomix
  surfaces without rerunning the whole repository.
- `bun run test:contracts`, `bun run test:all`, and `bun run test:all:full`
  are native Vitest lanes for the contract suite, the full shared suite, and
  the authoritative coverage pass. `test:all` stays coverage-free so the
  normal local execution loop does not pay the reporting cost.
- `verify` runs lint, typecheck, build, the Vitest coverage lane, and the Bun
  compatibility smoke instead of routing repository-wide coverage through Bun.

## Links

- `Makefile`
- `package.json`
- `README.md`
- `docs/MANUAL.md`
- `docs/RELEASE_CHECKLIST.md`
- [[CLI Command Lifecycle]]
- [[Release Candidate on Develop]]
- [[Tag Finalization and Main Promotion]]
- [[Two-Phase Release Protocol]]
- [[GitHub Actions Triggers]]
- [[MCP Import Graph Diagnostics]]
- [[MCP Vitest UI Cockpit]]
- [[Test Strategy Hardening]]
