# {{RELEASE_TAG}}

`cx-cli` now uses a two-phase release protocol:

- `develop` prepares the versioned release candidate
- the release tag finalizes the already-certified commit
- the release workflow verifies consistency before shipping
- `main` mirrors the shipped commit by fast-forward

This release continues the repository operating model:

- `cx mcp` for live hypothesis generation
- `cx notes` for durable repository cognition
- `cx bundle` and `cx verify` for proof-grade artifact handoff

Release assurance notes:

- The tagged commit already passed the required `develop` CI gate before publication.
- npm, GitHub release assets, and Homebrew all derive from the same packed tarball lineage.
- Vitest coverage remains the authoritative coverage-reporting lane for release assurance.

Trust model reminder:

- source tree: trusted
- notes: conditional
- agent output: untrusted until verified
- bundle: trusted
