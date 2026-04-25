# Repository Notes Guide

This directory is the durable upstream intent layer for the codebase. It is where repository reasoning becomes reusable memory for later humans, agents, bundles, and CI.

Notes do not override the canonical semantics in
[docs/modules/architecture/pages/mental-model.adoc](../docs/modules/architecture/pages/mental-model.adoc) and
[docs/modules/architecture/pages/system-contracts.adoc](../docs/modules/architecture/pages/system-contracts.adoc). Notes are
**conditional** knowledge: they are durable and reviewable, but they are still
claims about the system until governance, human review, or later proof paths
confirm them.

For the formal documentation set, start with [docs/README.md](../docs/README.md).
Use `notes/` for the definitive knowledge graph and `docs/` for snapshots, manuals, and
implementation contracts.

## Notes And Docs Boundary

Use `notes/` for durable repository reasoning.
Use `docs/` for canonical semantics, operator maps, and stable implementation
contracts.

In practice:

- `docs/modules/architecture/pages/mental-model.adoc` owns canonical semantics.
- `docs/modules/architecture/pages/system-contracts.adoc` owns cognition, boundary, and trust contracts.
- `docs/modules/manual/pages/operating-modes.adoc` and `docs/modules/architecture/pages/system-map.adoc` own onboarding and routing.
- Notes should support those documents with durable reasoning, not silently
  replace them with a second canonical layer.

Bundle manifests now carry short note summaries so downstream AI tooling can
inspect the note graph without reparsing raw Markdown.

`cx docs compile --profile architecture|manual|onboarding` promotes stable
notes into generated Antora pages, while `cx docs drift` checks that the
generated docs still match the note graph.

The layered truth model is:

- notes = intent truth
- specs = executable rule truth
- code = implementation truth
- tests = behavioral truth
- docs = communication truth

The notes graph is the repository cognition layer. It is where high-signal reasoning becomes durable enough for later humans, agents, bundles, and CI to reuse safely.

Use `cx notes links` to audit unresolved note references after you rename or
move entries in the note graph.
When code should point back into the note graph, place the `[[Note Title]]`
reference in a source comment so audits can distinguish intentional links from
plain syntax.

Operational command contracts such as `make test`, `make verify`, and
`make release` should live here as durable notes instead of ad hoc workflow
comments in docs or issue trackers.
Focused debugging workflows such as the MCP Vitest UI cockpit should also live
here when they explain how operators inspect a live subsystem boundary rather
than how CI proves the full repository state.

## Why This Directory Exists

This directory exists as the **upstream intent layer** for repository work.
Use it when the reasoning should become durable, queryable, and linkable. Keep
implementation and formal documentation aligned with the note graph when that
reasoning matures into a stable repository contract.

This is not a project-management folder.

- Project trackers are hierarchical and temporary.
- Repository notes are durable, linkable, and machine-routable.
- The goal is **complete knowledge capture**. Every design choice, mechanism, and constraint belongs in the graph.

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

### 3. Start With The Summary Contract

The first body paragraph is required. It becomes the manifest-side summary that later agents use to route into the right note without reparsing the whole graph.

Why this protects you: if a note cannot summarize itself in the opening paragraph, it is already too vague for fast machine routing and too noisy for durable repository memory.

### 4. Use The How / What / Why Model

Every note should answer these questions clearly:

- What is the durable fact, decision, mechanism, or failure mode?
- Why does it matter or which invariant does it protect?
- How should an operator, reviewer, or later agent apply it?

You do not have to use literal headings every time, but the note should make all three answerable on a quick read.

### 5. Connect Notes Radially

Every note should link outward.

Add links to:

- related notes
- code components
- adjacent constraints or decisions

The value of the system comes from the graph, not from isolated pages.

### 6. Keep IDs Stable

Every note uses a time-based frontmatter id in the form `YYYYMMDDHHMMSS`.

The id is for machines, search, routing, and stable reference. The filename is the human title. Do not put the numeric id in the visible title.

Stable ids matter because downstream automation can reference notes without depending on filenames that may drift over time.

## Recommended Workflow

1. Start from `Templates/Atomic Note Template.md`.
2. Assign a fresh `id` using local time in `YYYYMMDDHHMMSS` format.
3. Give the note a clear searchable title.
4. Write one thought in your own words.
5. Add explicit links to related notes and code paths.
6. Save the file with a human-readable filename that matches the note title.
7. Keep the whole note within `4000` body characters and `100` body lines so the graph stays high-signal.

Suggested filename style: `Clear Searchable Title.md`.

For live review, prefer MCP note tools over blind Markdown browsing. Use `notes_search(...)` to find the relevant notes, then `notes_read(...)` to inspect selected note ids. Audit graph integrity with `notes_check(...)`, `notes_drift(...)`, `notes_trace(...)`, `notes_links(...)`, `notes_backlinks(...)`, `notes_orphans(...)`, `notes_code_links(...)`, and `notes_graph(...)` after renames or note additions. Use `notes_ask(...)` when an agent needs bounded note-first evidence instead of an open-ended text search.

## Minimum Anatomy

Every note must contain:

- YAML frontmatter with `id`, `aliases`, `tags`, and `target`
- one atomic body with a non-empty opening summary paragraph
- one links section with explicit connections to notes, code, or both

Target values are project-defined routing labels. `current` is the default
label generated by `cx notes new`; teams can add their own labels and can
constrain them with `[notes.frontmatter.fields.target]` in `cx.toml`.

## Governance And CI

The notes layer is governed like code, not like scratch text.

- `validateNotes(...)` enforces timestamp note ids, the summary requirement, note size limits, and required frontmatter target.
- `cx notes check` surfaces governance failures, broken links, claim reference failures, supersession failures, and graph drift.
- `cx notes check` also warns when a `target: current` note references missing note or code targets, so implemented truth does not silently drift into ambiguity.
- `cx notes graph --format json` emits a unified graph of notes, specs, code, tests, docs, backlinks, unresolved refs, and orphans.
- `cx notes trace <note-id>` follows one note into linked notes, specs, code, tests, docs, and reverse backlinks.
- `bun run ci:notes:governance` keeps the cognition-layer gate visible as its own CI lane.
- `bun run ci:test:contracts` keeps the canonical documentation for the cognition layer aligned with the implementation.
- CI uploads observability and policy artifacts only after the full gate passes, so partial lanes do not look like a successful repository state.

Why this protects you: AI-generated notes are only useful when the graph preserves knowledge quality and signal-to-noise. CI should stop low-quality durable memory before it becomes trusted context.

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
