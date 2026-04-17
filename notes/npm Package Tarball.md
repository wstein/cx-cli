---
id: 20260416093011
aliases: ["npm registry tarball","npm tarball url"]
tags: ["distribution","npm","homebrew"]
---

# npm Package Tarball

`https://registry.npmjs.org/@wsmy/cx-cli/-/cx-cli-X.Y.Z.tgz` is the immutable npm tarball URL used by the Homebrew formula.
The release workflow computes the Homebrew SHA-256 from a local `npm pack` tarball built from the tagged checkout, ensuring the formula matches the exact released package without depending on registry timing.

## Links

- `scripts/generate-homebrew-formula.ts`
- `.github/workflows/release.yml`
- `package.json`
