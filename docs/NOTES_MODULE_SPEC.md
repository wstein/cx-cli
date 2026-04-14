# CX Notes Module Specification

## Goal

`cx` exists to provide tooling and standards for AI-driven projects in one unified suite. The notes module is the implementation of that standard for repository-native Zettelkasten knowledge graphs. It is not a task tracker, a scratchpad, or a backlog surrogate. Its purpose is to preserve architectural intent, durable constraints, and explicit links between ideas and code in a form that both humans and downstream automation can query safely.

For the document map and revision consensus, see [README.md](README.md) and
[spec-draft.md](spec-draft.md).

## Scope

This phase defines native notes support in four places:

1. `cx init` scaffolding
2. note file anatomy and templates
3. note validation and metadata extraction
4. notes integration through the default `docs` section

It now adds note parsing, validation, duplicate-ID detection, and manifest-side note summaries. It still does not add extraction-time YAML routing or Obsidian-specific automation beyond keeping the Markdown shape compatible with Obsidian.
It also adds graph-level link auditing so unresolved note references can be inspected explicitly.

## Why Notes Exist In The Unified Suite

The notes module is part of the automation path, not a philosophical sidecar. It integrates architectural intent into the unified project suite so that both local machines and CI/CD pipelines can treat project knowledge with the same rigor as code.

Before manifest-side summaries:

- an agent receives a bundle and sees that `notes/` exists
- it reparses raw Markdown note files one by one to discover architecture
- token spend rises before the agent has identified which note matters
- latency rises because every run repeats the same parsing work

After manifest-side summaries:

- the agent reads `manifest.notes[]` first
- it filters by stable timestamp id, title, alias, or summary text
- it opens only the one or two note files that are actually relevant
- token spend and round-trip latency drop because the broad scan is already serialized into machine-readable metadata

Concrete prompt contrast:

- before: "Read every file in `notes/` and figure out which architectural decisions apply to the manifest writer"
- after: "Read the manifest note summaries, find the notes about manifest writing or dirty-state checks, then open only those note ids through the MCP server"

The second workflow is the reason the notes module exists inside `cx` instead of being left as an unstructured Markdown folder.

## Init Behavior

When `cx init` writes a project to disk, it must create:

- `cx.toml`
- `notes/README.md`
- `notes/template-new-zettel.md`

Rules:

- `--stdout` prints only the starter `cx.toml`; it does not create `notes/`
- normal init creates missing notes files
- `--force` refreshes the generated notes files as well as `cx.toml`
- the command never creates any starter note beyond the README and template

## Notes Directory Layout

Required files:

- `notes/README.md` — the mandatory 101 guide
- `notes/template-new-zettel.md` — the canonical atomic note template

User-authored notes live beside those files in `notes/` and may use any human-readable filename.

## README Requirements

The guide must explain:

- why durable repository notes are different from project-management artefacts
- the principle of atomicity
- the need for explicit links to adjacent notes and code paths
- the time-based ID rule (`YYYYMMDDHHMMSS`)
- why stable IDs and manifest-side summaries reduce token spend and latency for downstream agents
- one concrete before-and-after agent scenario that contrasts raw Markdown reparsing with manifest-first querying

The guide should be instructional, measurable, and tied to operator or CI outcomes rather than philosophical terminology.

## Canonical Note Anatomy

Every note must use this minimal structure:

```md
---
id: YYYYMMDDHHMMSS
aliases: []
tags: []
---
Atomic body in the author's own words.

## Links

- [[Related note title]] - relationship
- src/path/to/component.ts - relevant code component
```

Rules:

- `id` is mandatory and machine authoritative
- `aliases` and `tags` are always present, even when empty
- the filename is the canonical human title; do not use the numeric id as the visible title
- the body must contain one discrete thought only
- the links section must point to other notes, code, or both

## Bundle Integration

The default starter config must include `notes/**` inside `[sections.docs].include`.

Canonical default:

```toml
[sections.docs]
include = ["docs/**", "notes/**", "README.md", "*.md"]
exclude = []
```

This ensures the repository contract carries both machine state and human intent.

## Implemented Behavior

This implementation now includes:

- note frontmatter parsing during validation
- strict `id` format checks using `YYYYMMDDHHMMSS`
- duplicate-ID detection across the notes directory
- aliases and tags normalization
- note summary extraction from the body for manifest use
- a `cx notes ...` command family for note creation and graph inspection
- unresolved note and code-reference auditing via `cx notes links`

The key downstream effect is that automation can inspect the note layer through
manifest metadata first, then open individual notes only when deeper context is
required.

## Future Extensions

The next production candidates are:

1. extraction-safe note parsing for downstream routing
2. richer note graph queries and traversals
3. manifest-side summaries beyond the first body paragraph
4. cross-file anchor validation for repository-local note references
