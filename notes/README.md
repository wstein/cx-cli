# Zettelkasten 101

Welcome to the repository mind.

This directory is a permanent knowledge layer for the codebase. It captures architectural intent, durable concepts, constraints, and decisions that should outlive any single sprint, ticket, or contributor.

## What This Is

The Zettelkasten method comes from Niklas Luhmann's slip-box practice. In a software repository, it means you do not treat knowledge as a pile of disconnected snippets. You grow a network of small, explicit notes that can be read, linked, revised, and reused over the full life of the codebase.

This is not a project-management folder.

- Project trackers are hierarchical and temporary.
- Zettelkasten notes are networked and durable.
- The goal is not task execution. The goal is preserving understanding.

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

That is the collector's fallacy: accumulating material without producing understanding.

A note is only useful when it explains the idea in your own words and makes the relation to this repository explicit.

### 3. Connect Notes Radially

Every note should link outward.

Add links to:

- related notes
- code components
- adjacent constraints or decisions

The value of the system comes from the graph, not from isolated pages.

### 4. Keep IDs Stable

Every note uses a time-based frontmatter id in the form `YYYYMMDDHHMM`.

The id is for machines, search, routing, and stable reference. The H1 is for humans. Do not put the numeric id in the visible title.

## The Barbell Method Of Triage

Capture at two ends of the spectrum:

- durable, high-value insights worth keeping for years
- small, fresh observations that can later be linked, merged, or discarded

Avoid the mushy middle of vague status notes, meeting debris, or copied snippets with no interpretation.

## Recommended Workflow

1. Start from `template-new-zettel.md`.
2. Assign a fresh `id` using local time in `YYYYMMDDHHMM` format.
3. Give the note a clear searchable title.
4. Write one thought in your own words.
5. Add explicit links to related notes and code paths.
6. Save the file with a human-readable name.

Suggested filename style: `clear-searchable-title.md`.

## Minimum Anatomy

Every note must contain:

- YAML frontmatter with `id`, `aliases`, and `tags`
- one H1 title
- one atomic body
- one links section with radial connections

This repository's scaffold template uses the H1 headline as the canonical
note title and filename. The filename is derived from the H1, so keep the title
clear, stable, and unique.

## What Does Not Belong Here

Do not use this directory for:

- sprint planning
- transient checklists
- copied code dumps
- meeting notes with no synthesis
- backlog management

If the content will be obsolete as soon as the ticket closes, it probably belongs somewhere else.