# CX Implementation Plan

This plan tracks the remaining work needed to keep the `cx` documentation set
and implementation aligned.

## Phase 1 - Documentation Consolidation

- Add a single docs index.
- Keep `spec-draft.md` as the editorial source of truth.
- Make supporting docs point back to the spec instead of restating it.

## Phase 2 - Notes Alignment

- Keep `notes/README.md` focused on durable knowledge, not project tracking.
- Align the notes module language with the documentation index and spec.
- Preserve the separation between notes as knowledge and docs as contract.

## Phase 3 - Implementation Guardrails

- Keep the TypeScript build clean.
- Keep `bun` as the primary workflow.
- Add targeted tests for any implementation work that follows the docs.
- Preserve deterministic planning, checksums, and extraction semantics.
