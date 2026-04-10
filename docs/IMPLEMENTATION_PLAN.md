# CX Implementation Plan

## Acceptance Criteria

- Every phase builds with `tsc`.
- `bun` is the primary developer workflow and lockfile owner.
- Every phase has targeted tests.
- Documentation reflects shipped behavior, not hoped-for behavior.
- Commits use conventional commit messages.

## Phase 1

Scope:

- repository scaffolding
- decision record
- starter README
- TypeScript build and test layout
- command and domain model skeleton

Exit criteria:

- project builds cleanly
- docs describe the implemented architecture

Status:

- complete

## Phase 2

Scope:

- config types, parsing, validation, and defaults
- deterministic discovery, classification, and section planning
- overlap and unmatched-file handling
- `cx init` and `cx inspect`

Exit criteria:

- plan output is deterministic
- overlap and config failures are well-diagnosed
- tests cover the core planning rules

Status:

- complete

## Phase 3

Scope:

- manifest builder and canonical TOON writer
- checksum generation
- `bundle`, `list`, `validate`, and `verify`
- adapter boundary for Repomix rendering

Exit criteria:

- bundles are structurally valid
- verification catches checksum and structure drift
- missing renderer capability fails cleanly

Status:

- complete for bundle, list, validate, and verify

## Next Phase Candidates

- richer bundle inspection and machine-readable reporting
- CI matrix against multiple Repomix versions
- packaging and release automation
