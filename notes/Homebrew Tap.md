---
id: 20260416093001
aliases: ["homebrew tap","wstein homebrew tap"]
tags: ["distribution","homebrew","release"]
---

# Homebrew Tap

`wstein/homebrew-tap` hosts the Homebrew formula used to install `@wsmy/cx-cli`.
This tap is updated from tagged releases in this repository by the single release workflow. The formula is generated from the same locally packed release tarball that is published to npm, then committed into the tap repo.

To let the source repo update the tap automatically, create `HOMEBREW_TAP_PUSH_TOKEN` as a fine-grained personal access token in GitHub Settings -> Developer settings -> Personal access tokens -> Fine-grained tokens -> Generate new token. Scope it to `wstein/homebrew-tap`, grant `Contents: Read and write`, and store it in the `homebrew` environment of the source repo.

## Links

- `scripts/generate-homebrew-formula.ts`
- `.github/workflows/release.yml`
- `notes/Homebrew Tap Automation.md`
- `README.md`
- `package.json`
