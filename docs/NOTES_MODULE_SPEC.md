# CX Notes Module Specification

## Goal

The notes module gives `cx` a permanent repository knowledge layer based on the Zettelkasten method. It is not a task tracker, a scratchpad, or a backlog surrogate. Its purpose is to preserve architectural intent, durable concepts, and explicit links between ideas and code.

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

- what Zettelkasten means in a repository context
- why durable notes are different from project-management artefacts
- the principle of atomicity
- the collector's fallacy
- the need for explicit radial links
- the time-based ID rule (`YYYYMMDDHHMMSS`)
- the barbell method of triage

The guide should be instructional, not philosophical filler.

## Canonical Note Anatomy

Every note must use this minimal structure:

```md
---
id: YYYYMMDDHHMMSS
aliases: []
tags: []
---
# Clear, searchable title

Atomic body in the author's own words.

## Links

- [[Related note title]] - relationship
- src/path/to/component.ts - relevant code component
```

Rules:

- `id` is mandatory and machine authoritative
- `aliases` and `tags` are always present, even when empty
- the visible title is the H1, not the numeric ID
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

## Future Extensions

The next production candidates are:

1. extraction-safe note parsing for downstream routing
2. richer note graph queries and traversals
3. manifest-side summaries beyond the first body paragraph
4. cross-file anchor validation for repository-local note references
