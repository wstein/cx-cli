<!-- Source: GOVERNANCE.md | Status: CANONICAL | Stability: STABLE -->

# Documentation Governance

This guide explains how documentation is organized, maintained, and marked for authority and stability.

## Source-of-Truth Markers

Every documentation file includes an HTML comment at the top declaring its source, status, and stability:

```
<!-- Source: FILENAME.md | Status: CANONICAL | Stability: STABLE -->
```

### Status Values

- **CANONICAL**: Authoritative source of truth. Changes here are binding. Other docs derive from this.
- **DERIVED**: Auto-generated or synced from another source. Do not edit directly; update the source instead.
- **EDITORIAL**: Explanatory or tutorial content. May lag the canonical source. Lower priority for consistency.

### Stability Values

- **STABLE**: Semver-protected contract. Breaking changes require major version bump (documented in release notes).
- **BETA**: Functional but subject to change in minor versions. Operators should pin versions if depending on this doc.
- **EXPERIMENTAL**: Actively developed. May be removed or substantially rewritten without notice.

---

## Canonical Documentation Map

| File | Status | Stability | Purpose |
|------|--------|-----------|---------|
| ARCHITECTURE.md | CANONICAL | STABLE | System architecture and layer design |
| MANUAL.md | CANONICAL | STABLE | Complete feature reference and CLI usage |
| STABILITY.md | CANONICAL | STABLE | Tool stability contracts and versioning |
| MENTAL_MODEL.md | CANONICAL | STABLE | Canonical semantics for the CX triad, Track A vs Track B, policy tiers, and artifact lifecycle |
| OPERATING_MODES.md | CANONICAL | STABLE | Operator-facing mode chooser and onboarding map |
| AGENT_OPERATING_MODEL.md | CANONICAL | STABLE | Integration-layer policy consequences for agent operators |
| AGENT_INTEGRATION.md | CANONICAL | STABLE | IDE and client integration guide |
| MCP_TOOL_INTENT_TAXONOMY.md | CANONICAL | STABLE | Tool categorization and intent |
| RELEASE_INTEGRITY.md | CANONICAL | STABLE | Release SBOM format and verification |
| EXTRACTION_SAFETY.md | CANONICAL | STABLE | Content filtering and safe extraction |
| NOTES_MODULE_SPEC.md | CANONICAL | STABLE | Notes schema and structure |
| GOVERNANCE.md | CANONICAL | STABLE | Documentation governance and doc map |
| config-reference.md | CANONICAL | STABLE | All cx.toml options and semantics |
| RELEASE_CHECKLIST.md | CANONICAL | STABLE | Release process and validation steps |

### Derived Documentation

Some files are generated or synced:

| File | Source | How Updated |
|------|--------|------------|
| README.md | MANUAL.md | Manual excerpt during release |
| API docs (if published) | Source code | Generated from JSDoc comments |

### Editorial Documentation

Tutorial and explanation docs:

| File | Purpose |
|------|---------|
| WORKFLOWS/* | Execution examples that show the model over time without redefining the canonical semantics |
| Getting Started (if added) | Introduction and quick-start tutorial |
| Troubleshooting (if added) | Common issues and solutions |
| FAQ (if added) | Frequently asked questions |

## Docs Surface Budget

`cx` intentionally keeps a small front-door docs surface.

### Front-Door Docs

These are the only documents that should behave like primary entrypoints:

- `README.md`
- `docs/README.md`
- `docs/SYSTEM_MAP.md`
- `docs/OPERATING_MODES.md`
- `docs/MANUAL.md`

### Canonical Core Docs

These own stable meaning and contracts, but they are not additional onboarding
doors:

- `docs/MENTAL_MODEL.md`
- `docs/SYSTEM_CONTRACTS.md`
- `docs/GOVERNANCE.md`

### Reference-Only Docs

Everything else should be written as reference, integration detail, workflow
example, or historical material.

That means:

- `ARCHITECTURE.md` is an implementation reference for contributors, not a
  first-read overview.
- `WORKFLOWS/*` are special-case execution examples, not parallel onboarding
  paths.
- `MIGRATIONS/*` and release-history material are historical references, not
  part of the operator front door.
- Agent integration and configuration docs should be linked by concern, not
  treated as general entrypoints.

### Default Rule

If a new document would introduce another plausible place to start, it should
usually become a section inside an existing front-door doc instead.

---

## Hard Hierarchy Contract

`cx` intentionally uses a hard documentation hierarchy so semantics have one canonical home.

### Canonical Roles

- `MENTAL_MODEL.md` owns canonical semantics.
- `OPERATING_MODES.md` maps those semantics to operator choices and progressive onboarding.
- `WORKFLOWS/*` shows concrete execution examples across time.
- `AGENT_*` documents the integration layer: policy consequences, tool sequences, client setup, and review loops.

### Non-Negotiable Rule

Everything outside `MENTAL_MODEL.md` must reference canonical semantics instead of redefining them.

That means:

- `OPERATING_MODES.md` should say which mode to choose, not restate the full semantics of the CX triad.
- `WORKFLOWS/*` should show commands, decisions, and outcomes, not redefine Track A vs Track B.
- `AGENT_*` docs should explain how agents consume the model through MCP and integration boundaries, not fork the semantics into a second source of truth.
- General docs such as `README.md`, `MANUAL.md`, and `ARCHITECTURE.md` should point back to the canonical layer with `See: MENTAL_MODEL.md` where deeper semantics would otherwise be repeated.

Why this protects you: once multiple docs compete to define the same concept, semantic drift becomes invisible until operators make the wrong decision from stale text. The hierarchy keeps one semantic source of truth and pushes every other doc toward mapping, execution, or integration.

---

## Update Procedures

### Updating Canonical Docs

1. Make changes directly in the canonical file
2. Ensure the change doesn't break the semver contract
3. Update the git log message to reference the doc change
4. If a derived doc depends on this content, update it too

### Updating Derived Docs

**Do not edit directly.** Instead:
1. Identify the canonical source
2. Make the change in the source
3. Re-run the generation/sync process

### Updating Editorial Docs

Changes are welcome. Update the file, no special approval needed.

---

## Stability Policy

### STABLE Documents

**What it means:**
- Output schema and option names are locked
- Deprecations are announced 2+ releases in advance with migration guidance
- Breaking changes require major version bump

**Example:** If STABILITY.md says tool `list` is STABLE, we cannot remove the tool or rename its output fields without releasing v1.0.

### BETA Documents

**What it means:**
- Functional but may evolve in minor releases
- Field names, structure, or guidance may change
- Deprecation notice given 1 release in advance

**Example:** If AGENT_OPERATING_MODEL.md policy tier system were BETA, operators should not depend on exact policy names across versions.

### EXPERIMENTAL Documents

**What it means:**
- Subject to removal or major rewrite
- No advance notice required
- Do not build long-term dependencies on content

---

## Links to Governance

When updating or referencing governance decisions:

- **"What's the contract?"** → [STABILITY.md](STABILITY.md)
- **"What do the concepts mean?"** → [MENTAL_MODEL.md](MENTAL_MODEL.md)
- **"Which mode should I choose first?"** → [OPERATING_MODES.md](OPERATING_MODES.md)
- **"How do tools work in an agent integration?"** → [AGENT_OPERATING_MODEL.md](AGENT_OPERATING_MODEL.md)
- **"What are all the options?"** → [config-reference.md](config-reference.md) (CANONICAL)
- **"When do I use each workflow?"** → [OPERATING_MODES.md](OPERATING_MODES.md)
- **"Where can I see the model play out over time?"** → [WORKFLOWS/friday-to-monday.md](WORKFLOWS/friday-to-monday.md)
- **"Is this doc authoritative?"** → Check the source-of-truth marker at the top

---

## Why This System?

Without explicit governance, docs drift: some become outdated, some contradict each other, and operators don't know what to trust.

By marking every doc:
- Operators know which docs are safe to depend on (CANONICAL + STABLE)
- We can deprecate docs intentionally (moving from STABLE to EXPERIMENTAL)
- Derived docs stay in sync with their sources
- Tutorial content can be approximate (EDITORIAL) without breaking guarantees

This is lightweight (one-line comments) but removes ambiguity.
