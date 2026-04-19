<!-- Source: NOTES_MODULE_SPEC.md | Status: CANONICAL | Stability: STABLE -->

# CX Notes Module Specification

## Goal

`cx` exists to provide tooling and standards for AI-driven projects in one unified suite. The notes module is the implementation of that standard for repository-native notes graphs. It is not a task tracker, a scratchpad, or a backlog surrogate. Its purpose is to preserve architectural intent, durable constraints, and explicit links between ideas and code in a form that both humans and downstream automation can query safely.

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

## Notes As The Cognition Layer

The notes graph is the repository cognition layer.

That means notes are not just documentation. They are the durable reasoning surface that sits between live exploration and proof-grade artifacts:

- Track B uses notes to preserve hypotheses that proved useful.
- Track A carries note summaries into manifests so the proof path can keep the reasoning attached.
- CI treats note quality as an integrity concern because low-signal notes degrade both humans and agents.

For AI-generated notes especially, the question is not "did text get produced?" It is "did the graph gain durable, high-signal knowledge?"

See: [SYSTEM_CONTRACTS.md](SYSTEM_CONTRACTS.md) for the formal cognition contract and trust propagation model that sit under this module.

## Governance Model: How, What, Why

Every note should answer three questions clearly, even when the author does not use literal section headings:

- **What** is the durable fact, mechanism, or decision?
- **Why** does it matter or which invariant does it protect?
- **How** should an operator, reviewer, or later agent apply it?

The opening paragraph is the summary contract. It must stand on its own because `manifest.notes[]` uses that summary as the fast routing path for later automation.

## Governance Rules

The validator and CI now enforce these baseline rules:

- a note must produce a non-empty summary from its first paragraph
- that summary must be non-trivial
- untouched template boilerplate is not allowed to survive into committed notes
- a note body must stay at or below `4000` characters
- a note body must stay at or below `100` lines

These are cognition-layer limits, not arbitrary formatting preferences.

Why this protects you: high-signal repository memory depends on short, atomic notes that humans and agents can classify quickly. Once notes become oversized or summary-free, the graph stops acting like a routing layer and starts acting like an unbounded dump of prose.

## Staleness and Drift Pressure

Cognition quality is not only about structure. It is also about whether a note is staying current enough to trust.

`cx notes check` now reports:

- note age derived from the note timestamp id
- staleness labels (`fresh`, `aging`, `stale`)
- code-drift pressure when a note points at repository paths that are missing, excluded, or outside the VCS master list
- contradiction pressure when a note claims code state that conflicts with the repository or with sibling notes

These signals are diagnostic rather than blocking by themselves. They tell operators where durable memory is decaying before that decay becomes an architectural blind spot.

Why this protects you: an old note with drifting code references can still parse cleanly while quietly becoming misleading. Staleness and contradiction checks make that decay visible before agents start treating stale memory as current architecture.

## CI Check Path

The governance path is operational, not aspirational:

1. `validateNotes(...)` enforces summary and size rules during bundling, validation, note CRUD, MCP note access, and graph checks.
2. `cx notes check` surfaces governance failures directly for local review and CI logs.
3. `bun run ci:notes:governance` makes the cognition-layer gate visible as its own CI lane.
4. `bun run ci:test:contracts` keeps the canonical docs and workflow references aligned with the implemented governance model.
5. `bun run ci:report:observability` emits CI-readable markdown and JSON summaries so note quality gates and fast-lane drift stay visible over time.
6. CI uploads those reports only after the full lane set passes, so operators do not confuse partial diagnostics with a green repository gate.

If the note layer drifts, the project should fail loudly before that drift becomes part of a trusted artifact or a long-lived agent workflow.

## Contradiction Pressure

Contradiction scoring is separate from staleness.

- **staleness** asks whether a note is old or drifting
- **contradiction pressure** asks whether a note makes claims that conflict with current code state or with sibling notes

Examples:

- a note says `[[src/feature.ts]]` is present, but the path is gone
- a note says `[[src/feature.ts]]` is missing, but the path exists
- two notes make opposite presence/absence claims about the same repository path

Why this protects you: stale notes are risky, but contradictory notes are worse because they create false confidence. The cognition layer should expose disagreement explicitly instead of letting conflicting memory look equally valid.

## Init Behavior

When `cx init` writes a project to disk, it must create:

- `cx.toml`
- `Makefile`
- `notes/README.md`
- `notes/Templates/Atomic Note Template.md`

Rules:

- `--stdout` prints only the starter `cx.toml`; it does not create `notes/`
- normal init creates missing notes files
- `--force` refreshes the generated notes files as well as `cx.toml`
- the command never creates any starter note beyond the README and template

## Notes Directory Layout

Required files:

- `notes/README.md` — the mandatory 101 guide
- `notes/Templates/Atomic Note Template.md` — the canonical atomic note template

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
- the first body paragraph must work as a stand-alone summary
- the body should explain the note's what, why, and how clearly enough for later reuse
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
- strict `id` format checks using `YYYYMMDDHHMMSS` (with optional milliseconds)
- duplicate-ID detection across the notes directory
- aliases and tags normalization
- note summary extraction from the body for manifest use
- `codeLinks[]` extraction from note bodies and propagation into `manifest.notes[]` records, enabling manifest-first querying of which notes reference specific source files
- a `cx notes ...` command family for note creation and graph inspection
- unresolved note and code-reference auditing via `cx notes links`
- comment-scoped code reference discovery, so only intentional `[[Note]]` references in source comments count as note links
- cross-file anchor validation: `[[Note Title#Section Heading]]` wikilinks are checked against actual headings in the target note, reported as `anchor-not-found` broken links
- graph reachability queries via `cx notes graph --id <id> --depth <n>` and the `notes_graph` MCP tool, returning all notes reachable within N wikilink hops from a seed note

## Linked-Note Enrichment Semantics

Linked-note enrichment is a post-planning orchestration step controlled by `manifest.includeLinkedNotes`.

- It is inclusion-changing, not advisory: qualifying linked notes are injected into the bundle plan.
- It does not alter the core VCS planning model: enrichment runs after file classification.
- The target section is `docs` when present, otherwise the first configured section.
- Notes already claimed by sections or assets are not reinjected.
- The target section is re-sorted after injection to preserve deterministic ordering.

Operator inspection path:

1. Run `cx inspect --json` to see the planned section file lists before rendering.
2. Run `cx notes graph --id <seed> --depth <n>` to inspect graph reachability from the seed note.

Inspect JSON reports inclusion provenance for each planned text file:

- `section_match` for files claimed directly by a configured section
- `linked_note_enrichment` for notes injected by the post-planning graph pass
- `manifest_note_inclusion` when `manifest.includeLinkedNotes` is the setting that made the note appear

Depth semantics for graph inspection:

- `depth = 1` includes direct wikilink neighbors.
- `depth = N` includes notes reachable within at most `N` wikilink hops.

The key downstream effect is that automation can inspect the note layer through
manifest metadata first, then open individual notes only when deeper context is
required.

## Note ID Format

IDs use the format `YYYYMMDDHHmmSS` at a minimum. `cx` also accepts and
generates IDs with millisecond precision (`YYYYMMDDHHmmSSmmm`). The frontmatter
parser treats the `id` field as a string — not a number — so precision is never
lost regardless of digit count.

## Future Extensions

The following candidates remain for future implementation:

1. extraction-safe note parsing for downstream routing (unimplemented)
2. manifest-side summaries beyond the first body paragraph (unimplemented)
3. staleness and contradiction checks so note truth can be challenged explicitly
4. agent traceability that links note changes, audit trails, and workflow review history into one provenance path
