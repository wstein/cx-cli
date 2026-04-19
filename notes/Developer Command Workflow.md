---
id: 20260417105501
aliases: ["make workflow", "developer commands", "release workflow"]
tags: ["workflow", "development", "release"]
---

`make test` is the fast local feedback loop, `make verify` is the full
pre-merge gate with coverage, and `make release VERSION=x.y.z` is the repository-local handoff
into the release script. Keeping those roles separate keeps the common command
quick while making the release path explicit and repeatable.

- The `Makefile` delegates to `package.json` scripts using 1:1 shell shim wrappers.

## Testing and coverage conventions

- `package.json` does not define an explicit `coverage` task; coverage is collected by the test commands.
- The default test task runs the unit test suite.
- Tests always collect coverage information.
- `verify` runs the full integration and unit test suite.

## Links

- `Makefile`
- `package.json`
- `README.md`
- `docs/MANUAL.md`
- `docs/RELEASE_CHECKLIST.md`
- [[CLI Command Lifecycle]]
- [[GitHub Actions Triggers]]
- [[Test Strategy Hardening]]
