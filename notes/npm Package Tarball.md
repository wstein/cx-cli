---
id: 20260416093011
aliases: ["npm registry tarball","npm tarball url"]
tags: ["distribution","npm","homebrew"]
---
# npm Package Tarball

`https://registry.npmjs.org/@wsmy/cx-cli/-/cx-cli-X.Y.Z.tgz` is the immutable npm tarball URL used by the Homebrew formula.
The release workflow computes the Homebrew SHA-256 from a local `npm pack` tarball built from the tagged checkout, so the formula matches the exact released package without depending on registry timing.

The tarball is the shipped runtime package:

- it carries the kernel-owned proof path
- it does not carry a runtime Repomix fork dependency
- oracle/reference adapter behavior remains outside the shipped proof-path contract

## Links

- `scripts/generate-homebrew-formula.js`
- `notes/Homebrew Tap Automation.md`
- `package.json`
- [[Homebrew Tap Automation]]
- [[Homebrew Tap]]
- [[npm Package Page]]
