# Repository Notes Guide

This directory is a permanent knowledge layer for the codebase. It captures architectural intent, durable concepts, constraints, and decisions that should outlive any single sprint, ticket, or contributor.

For the formal documentation set, start with [docs/README.md](../docs/README.md).
The revision consensus for the repository lives in
[docs/spec-draft.md](../docs/spec-draft.md).
Use `notes/` for durable knowledge and `docs/` for decisions, plans, and
implementation contracts.

Bundle manifests now carry short note summaries so downstream AI tooling can
inspect the note graph without reparsing raw Markdown.

Use `cx notes links` to audit unresolved note references after you rename or
move entries in the note graph.

## Why This Directory Exists

This directory exists to keep durable repository knowledge queryable.

This is not a project-management folder.

- Project trackers are hierarchical and temporary.
- Repository notes are durable and linkable.
- The goal is not task execution. The goal is preserving reusable understanding.

## Before and After for Agents

Before manifest-side summaries:

- an agent sees `notes/` and has to open raw Markdown files one by one
- token spend rises before the agent knows which note matters
- latency rises because every run repeats the same broad scan

After manifest-side summaries:

- the agent reads `manifest.notes[]` first
- it filters by stable id, title, alias, or summary text
- it opens only the note files that are actually relevant
- token spend and latency drop because the broad scan is already serialized

Example prompt shift:

- before: "Read every note and figure out how dirty-state enforcement works"
- after: "Read manifest note summaries, find the notes about dirty-state enforcement, then open only those note ids"

That is the practical value of this directory in an AI workflow.

## The Core Rules

### 1. Atomicity

Each note must contain one discrete thought.

Good atomic notes describe exactly one:

- architectural decision
- invariant
- mechanism
- concept
- failure mode
- tradeoff

If a note contains multiple unrelated ideas, split it.

### 2. Write In Your Own Words

Do not paste raw code or external text and call it knowledge.

A note is only useful when it explains the idea in your own words and makes the relation to this repository explicit.

### 3. Connect Notes Radially

Every note should link outward.

Add links to:

- related notes
- code components
- adjacent constraints or decisions

The value of the system comes from the graph, not from isolated pages.

### 4. Keep IDs Stable

Every note uses a time-based frontmatter id in the form `YYYYMMDDHHMMSS`.

The id is for machines, search, routing, and stable reference. The filename is the human title. Do not put the numeric id in the visible title.

Stable ids matter because downstream automation can reference notes without depending on filenames that may drift over time.

## Recommended Workflow

1. Start from `template-new-zettel.md`.
2. Assign a fresh `id` using local time in `YYYYMMDDHHMMSS` format.
3. Give the note a clear searchable title.
4. Write one thought in your own words.
5. Add explicit links to related notes and code paths.
6. Save the file with a human-readable filename that matches the note title.

Suggested filename style: `Clear Searchable Title.md`.

## Minimum Anatomy

Every note must contain:

- YAML frontmatter with `id`, `aliases`, and `tags`
- one atomic body
- one links section with explicit connections to notes, code, or both

 This repository uses the filename as the canonical note title. Do not add an
 H1 header in the note body because Obsidian already displays the filename as
 the title. Use a clear, human-readable filename that matches the note title.

 Use link references that match the note title, for example
 `[[Related note title]]`.

## What Does Not Belong Here

Do not use this directory for:

- sprint planning
- transient checklists
- copied code dumps
- meeting notes without synthesis
- backlog management

If the content will be obsolete as soon as the ticket closes, it probably belongs somewhere else.
