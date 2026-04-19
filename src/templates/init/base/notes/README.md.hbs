# Repository Notes Guide

This directory is the **primary source of truth** for the project. Every architectural idea, implementation decision, and invariants must enter `notes/` before it is documented or shipped.

## Why This Directory Exists

`notes/` is the upstream intent layer for the repository. It captures durable knowledge in a machine-queryable graph so the project can be understood, audited, and reasoned about more reliably than raw code or ad-hoc docs.

The notes graph is the repository cognition layer. It is where high-signal reasoning becomes durable enough for later humans, agents, bundles, and CI to reuse safely.

- Notes are the first place to record architectural ideas.
- The code and docs must stay in sync with the note corpus.
- This is not a project-management or task-tracking folder.

## Notes-First Workflow

Before implementing a feature or writing a design doc:

1. Create a note for the idea.
2. Link it to related notes and code paths.
3. Keep the note atomic and explicit.
4. Use it as the source of truth for the resulting implementation.

This keeps the repository’s knowledge graph live and prevents important decisions from being hidden in code comments or scattered docs.

## Core Rules

### Atomicity

Each note must contain one discrete thought:
- one architectural decision
- one invariant
- one mechanism
- one concept
- one failure mode

If a note contains multiple unrelated ideas, split it.

### Write in Your Own Words

Do not paste raw code or external text. A note is useful only when it explains the idea clearly and connects it back to this repository.

### Start With The Summary Contract

The first body paragraph is required. It becomes the manifest-side summary that later agents use to route into the right note without reparsing the whole graph.
Keep that summary substantive: at least one real sentence with at least 6 words. One-line placeholders are rejected.

### Use The How / What / Why Model

Every note should answer these questions clearly:

- What is the durable fact, decision, mechanism, or failure mode?
- Why does it matter or which invariant does it protect?
- How should an operator, reviewer, or later agent apply it?

### Connect Notes Radially

Every note should link outward to:
- related notes
- code components
- adjacent constraints or decisions

The value is in the graph, not isolated pages.

### Keep IDs Stable

Each note uses a time-based YAML id in the form `YYYYMMDDHHMMSS`.
The filename is the canonical title; the id is machine authoritative.

## Recommended Workflow

1. Start from `Templates/Atomic Note Template.md`
2. Assign a fresh `id` using local time
3. Use a clear searchable title
4. Write one focused thought in your own words
5. Add explicit links to related notes and code paths
6. Save the file with a human-readable filename
7. Keep the note within `4000` body characters and `100` body lines so the graph stays high-signal

## Minimum Anatomy

Every note must contain:

- YAML frontmatter with `id`, `aliases`, and `tags`
- one atomic body with a non-empty opening summary paragraph
- one links section with explicit connections

## Governance And CI

- `validateNotes(...)` enforces the summary requirement, minimum summary substance, template replacement, and note size limits.
- `cx notes check` surfaces governance failures, broken links, and graph drift.
- `bun run ci:notes:governance` keeps the cognition-layer gate visible as its own CI lane.
- `bun run ci:test:contracts` keeps the canonical documentation aligned with the implementation.

## What Does Not Belong Here

Do not use this directory for:
- sprint planning
- transient checklists
- copied code dumps
- meeting notes without synthesis
- backlog management
