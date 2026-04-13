# CX Notes Module Specification

## Goal

The notes module gives `cx` a permanent repository knowledge layer based on the Zettelkasten method. It is not a task tracker, a scratchpad, or a backlog surrogate. Its purpose is to preserve architectural intent, durable concepts, and explicit links between ideas and code.

For the document map and revision consensus, see [README.md](README.md) and
[spec-draft.md](spec-draft.md).

## Scope

This phase defines native notes support in three places:

1. `cx init` scaffolding
2. note file anatomy and templates
3. bundle integration through the default `docs` section

It does not yet add note parsing, indexing, validation, extraction-time YAML routing, or Obsidian-specific automation beyond keeping the Markdown shape compatible with Obsidian.

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

This ensures bundles carry both machine state and human intent.

## Non-Goals In This Phase

This implementation intentionally does not:

- parse note frontmatter during bundling
- validate that every note `id` is unique
- enforce link correctness
- generate note indexes or graphs
- add a dedicated `cx notes ...` command family

## Future Extensions

The next production candidates are:

1. frontmatter validation and duplicate-ID detection
2. extraction-safe note parsing for downstream routing
3. note graph inspection commands
4. manifest-side note summaries for AI tooling
