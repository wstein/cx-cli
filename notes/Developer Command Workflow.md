---
id: 20260417105501
aliases: ["make workflow", "developer commands", "release workflow"]
tags: ["workflow", "development", "release"]
---

`make test` is the fast local feedback loop, `make verify` is the full
pre-merge gate, and `make release VERSION=x.y.z` is the repository-local handoff
into the release script. Keeping those roles separate keeps the common command
quick while making the release path explicit and repeatable.

## Links

- `Makefile`
- `package.json`
- `README.md`
- `docs/MANUAL.md`
- `docs/RELEASE_CHECKLIST.md`
