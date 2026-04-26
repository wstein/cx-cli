---
id: 20260416093041
aliases: ["repomix cx fork","@wsmy/repomix-cx-fork"]
tags: ["dependency","repomix","package"]
---
# Repomix CX Fork

`https://github.com/wstein/repomix-cx-fork` was the temporary compatibility fork
used during the native-render migration.

It is no longer part of the shipped `cx-cli` runtime. The production proof path
is kernel-owned, and compatibility is now preserved through parity tests rather
than by shipping the fork.

As of the official `repomix` 1.14.0 reference-oracle upgrade, this package still
does not track or ship `@wsmy/repomix-cx-fork`. The fork remains historical; cx
guards official-adapter drift with `scripts/repomix-adapter-parity.js`, which
compares the installed adapter against a checked-in `repomix` 1.13.1 baseline
for rendered bytes, per-file token counts, total tokens, and security findings.

## Removal consequences

- lower runtime supply-chain surface
- CI simplified to an official reference oracle instead of a shipped fork
- no runtime fork dependency inside the published CLI package
- fork version skew is explicit: the fork is not a supported runtime path in this
  repository

## Links

- `package.json`
- `.github/workflows/ci.yml`
- `README.md`
- [[Repomix Adapter Boundary]]
- [[Structured Render Contract]]
- [[cx-cli GitHub Repository]]
