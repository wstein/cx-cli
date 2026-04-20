# Changelog

This file records user-facing release changes for `cx`.

## [0.4.0] - 2026-04-19

### Release framing

`cx` now explicitly operates as three cooperating surfaces:

- immutable snapshots (`cx bundle`)
- live agent protocol (`cx mcp`)
- durable knowledge (`cx notes`)

Track B generates hypotheses. Track A generates proofs. Notes preserve durable reasoning between them.

### What changed in 0.4.0

#### 1. Coverage and release assurance

- Added a dedicated Vitest coverage lane with HTML, LCOV, JSON summary, and Markdown reporting.
- Coverage now participates directly in release assurance and the public Pages surface.

#### 2. MCP debugging cockpit

- Added focused Vitest MCP lanes and UI-oriented debugging guidance for startup hangs, policy denials, and slow import chains.
- Exposed the MCP tool catalog through `cx mcp catalog --json` so automation can inspect tool capability and stability metadata directly.

#### 3. Cognition and trust model

- Notes governance now includes cognition scoring, staleness checks, contradiction pressure, and explicit trust propagation.
- Manifests and operator tooling now carry trust and traceability metadata instead of leaving those boundaries implicit.

#### 4. Canonical operating model

- The docs now explicitly define Track B as hypothesis generation and Track A as proof generation.
- Notes are now described consistently as the durable cognition layer between live investigation and proof-grade artifacts.

#### 5. Native proof path is the shipped runtime

- The shipped CLI now presents the native kernel as the production proof path for `bundle`, `validate`, `verify`, and `extract`.
- Repomix is no longer described as the primary runtime architecture.
- The remaining adapter/oracle seam is for diagnostics and parity visibility only.

#### 6. Closed release line

- `v0.4.0` closes the render-kernel and fork-exit transition as a release line.
- Follow-up work after `v0.4.0` is contract tightening, documentation hardening, and bounded scanner evolution rather than another proof-path architecture flip.

### MCP stability in 0.4.0

MCP remains an evolving integration surface in 0.4.0. Core local workflows are ready for serious use, but the MCP contract should still be treated conservatively for long-term external integrations outside the documented stable subset.

### Coverage in 0.4.0

Vitest coverage is now the authoritative coverage-reporting lane for release assurance. Bun remains part of the execution and compatibility matrix.

### Migration notes

See [docs/MIGRATIONS/0.4.0.md](docs/MIGRATIONS/0.4.0.md).
