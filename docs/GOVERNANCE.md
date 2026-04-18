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
| AGENT_OPERATING_MODEL.md | CANONICAL | STABLE | Three-workflow model, policy tiers, decision matrix |
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
| Getting Started (if added) | Introduction and quick-start tutorial |
| Troubleshooting (if added) | Common issues and solutions |
| FAQ (if added) | Frequently asked questions |

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
- **"How do tools work?"** → [AGENT_OPERATING_MODEL.md](AGENT_OPERATING_MODEL.md)
- **"What are all the options?"** → [config-reference.md](config-reference.md) (CANONICAL)
- **"When do I use each workflow?"** → [AGENT_OPERATING_MODEL.md](AGENT_OPERATING_MODEL.md) (decision matrix)
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
