---
id: 20260416093031
aliases: ["cx-cli repository","wstein cx-cli","github repo cx-cli"]
tags: ["repository","source","distribution"]
---
# cx-cli GitHub Repository

`https://github.com/wstein/cx-cli` is the source repository for the CLI project.
It defines package metadata, the single release workflow, Homebrew integration, and the public documentation that drives distribution and CI/CD.

The repository is the canonical place where the post-fork architecture is
described and released:

- native kernel is the production proof path
- adapter/oracle code is reference-only
- release assets no longer ship a runtime fork dependency

## Links

- `.github/workflows/release.yml`
- `scripts/generate-homebrew-formula.js`
- `README.md`
- [[Homebrew Tap]]
- [[npm Package Page]]
- [[Repomix CX Fork]]
