---
id: 20260416093011
aliases: ["npm registry tarball","npm tarball url"]
tags: ["distribution","npm","homebrew"]
---

# npm Package Tarball

`https://registry.npmjs.org/@wsmy/cx-cli/-/cx-cli-X.Y.Z.tgz` is the immutable npm tarball URL used by the Homebrew formula.
The CI workflow computes its SHA-256 checksum from the published tarball before writing the formula, ensuring Homebrew installs the exact released package.

## Links

- `scripts/generate-homebrew-formula.ts`
- `.github/workflows/publish-homebrew.yml`
- `package.json`
