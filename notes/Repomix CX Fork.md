---
id: 20260416093041
aliases: ["repomix cx fork","@wsmy/repomix-cx-fork"]
tags: ["dependency","repomix","package"]
target: current
---
# Repomix CX Fork

`https://github.com/wstein/repomix-cx-fork` was the temporary compatibility fork
used during the native-render migration.

It is no longer part of the shipped `cx-cli` runtime. The production proof path
is kernel-owned, and compatibility is now preserved through parity tests rather
than by shipping the fork.

## Removal consequences

- lower runtime supply-chain surface
- CI simplified to an official reference oracle instead of a shipped fork
- no runtime fork dependency inside the published CLI package

## Links

- `package.json`
- `.github/workflows/ci.yml`
- `README.md`
- [[Repomix Adapter Boundary]]
- [[Structured Render Contract]]
- [[cx-cli GitHub Repository]]
