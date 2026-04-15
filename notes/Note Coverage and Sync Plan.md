---
id: 20260415164500
aliases: ["note coverage plan", "sync audit"]
tags: [notes, planning, architecture]
---

# Plan: Note Coverage and Sync Audit

This plan outlines the steps to bring the `notes/` directory into full alignment with the project's complexity and current implementation.

## Phase 1: Knowledge Surface Mapping

1.  **Codebase Feature Scan**: Identify all major mechanisms in `src/` that are not yet recorded as atomic notes.
    -   *Transport Mechanisms*: CLI command dispatch, MCP stdio protocol, error handling.
    -   *Core Logic*: Config loading and inheritance, VCS fallback logic, checksum/sidecar generation, token calculation.
    -   *I/O Patterns*: Path resolution, streaming output vs structured JSON, safe file writes.
    -   *Validation*: Zod schema integration, file boundary enforcement.

2.  **Doc Content Handoff**: Identify architectural decisions in `docs/` (e.g., in `spec-draft.md` or `ARCHITECTURE.md`) that have not been backfilled into atomic notes.

## Phase 2: Missing Note Creation

Create atomic notes for the following topics to ensure `notes/` is the primary source of truth:

-   **Transport Layer**: `MCP Transport Protocol.md`, `CLI Command Lifecycle.md`.
-   **Configuration Layer**: `Config Inheritance and Overlays.md`, `Environment Variable Resolution.md`.
-   **Planning Core**: `Planning Boundary Enforcement.md`, `Section Ownership and Overlaps.md`.
-   **Artifact Generation**: `Bundle Sidecar Integrity.md`, `Deterministic Hashing Strategy.md`.
-   **Extraction and Recovery**: `Bundle Extraction Safety Invariants.md`.

## Phase 3: Continuous Sync Enforcement

1.  **Audit Links**: Run `cx notes links` regularly to find missing links between the new notes and the existing graph.
2.  **Code-to-Note Validation**: Use `cx notes code-links` to ensure every core component in `src/` is referenced by a note.
3.  **Handoff Verification**: Update the contribution guide to require a matching note for every new feature or architectural change.

## Goal

Ensure `notes/` is not just a high-level overview, but a complete and machine-queryable record of **every** aspect of the `cx-cli` implementation.
