<!-- Source: STABILITY.md | Status: CANONICAL | Stability: STABLE -->

# Stability Tiers

cx-cli tools are classified into four stability tiers, each with distinct guarantees and expected usage patterns. The tier of each tool appears in its MCP description with the format `[TIER_NAME]` (e.g., `[STABLE]`). For machine-readable inspection, `cx doctor mcp --json` exposes the registered MCP tool catalog with each tool's `name`, `capability`, and `stability`.

## Tier Definitions

## Current Reliability Focus

The current stability push is intentionally scoped to global-state reduction,
not broad toolchain replacement. `cx` continues to standardize on `yargs`,
`bun:test`, Bun-first CI execution, and the Repomix fork while reliability work
targets command I/O boundaries, workspace context injection, and clearer test
separation between pure behavior and integration seams.
CI now declares a minimum supported Bun runtime (`1.3.11`) and continuously
tests both the minimum and `latest` Bun lanes to detect regressions across the
supported runtime envelope.
The fast CI lane is intentionally unit-only and guarded by
`bun run ci:guard:fast-lane` so integration suites do not silently leak into
the low-latency feedback path.
Fast-lane runtime is also monitored with warning-first regression policy:
`bun run ci:test:fast:monitored` records timing drift and fails only on
sustained significant regressions.
The workflow graph is gated behind `test-fast`: downstream CI lanes do not
start if the fast gate is red, and CI artifacts are uploaded only after the
full lane set passes.

### STABLE

**Guarantee:** Tools in this tier have a documented, semver-protected API contract. Breaking changes require a major version bump of cx-cli.

**Output Schema:** The JSON output structure is locked. Field names, types, and presence are guaranteed to remain consistent across minor and patch releases.

**Deprecation:** Deprecated features will be signaled 2+ releases in advance with clear migration guidance.

**Examples:** `list`, `grep`, `read`, `inspect`, `bundle`, `notes_new`, `notes_read`, `notes_update`, `notes_delete`, `notes_rename`, `notes_search`, `notes_list`, `notes_backlinks`, `notes_orphans`, `notes_code_links`, `notes_links`, `notes_graph`

**Use in:** Production CI/CD pipelines, long-lived scripts, documented integrations.

### BETA

**Guarantee:** Tools in this tier are functional and actively used, but their schema and behavior may evolve in minor releases (e.g., output fields added, removed, or renamed).

**Output Schema:** The core functionality is stable, but the JSON structure may change between minor versions. Operators should write defensive parsers or pin to a specific version.

**Deprecation:** Planned breaking changes will be announced 1 release in advance.

**Examples:** `doctor_mcp`, `doctor_workflow`, `doctor_overlaps`, `doctor_secrets`, `replace_repomix_span`

**Use in:** Scripts that can tolerate schema changes, exploratory automation, diagnostic/observability workflows.

### EXPERIMENTAL

**Guarantee:** Tools in this tier are under active development. APIs and behavior are subject to change or removal without notice.

**Deprecation:** No advance notice is provided; experimentals may be removed in any release.

**Use in:** Testing, proof-of-concept code, internal tooling only.

### INTERNAL

**Guarantee:** Tools in this tier are not advertised publicly via MCP. They are used internally by cx-cli tests or development workflows.

**Use in:** Tests and internal development only; external tooling should not depend on these.

---

## Versioning Policy

| Scenario | Tier | Action |
|----------|------|--------|
| Add a new field to a STABLE tool's output | STABLE | Requires major version bump |
| Rename a field in a BETA tool's output | BETA | Allowed in minor version bump |
| Remove a BETA tool entirely | BETA | Requires minor version bump with 1-release deprecation notice |
| Remove a STABLE tool | STABLE | Requires major version bump with 2+ release deprecation notice |
| Add a new tool | N/A | Launched at current tier; increment minor version |

---

## Migration Guide

If a tool transitions from BETA to STABLE or is deprecated, the release notes will include:
1. The change (e.g., "doctor_workflow output schema is now stable")
2. Any schema changes in that version
3. Guidance for operators updating automation

---

## Tool Stability Matrix

| Tool | Tier | Category | Stability Since |
|------|------|----------|-----------------|
| list | STABLE | Workspace | v0.1.0 |
| grep | STABLE | Workspace | v0.1.0 |
| read | STABLE | Workspace | v0.1.0 |
| replace_repomix_span | BETA | Workspace | v0.2.0 |
| inspect | STABLE | Planning | v0.1.0 |
| bundle | STABLE | Planning | v0.1.0 |
| doctor_mcp | BETA | Doctor | v0.2.0 |
| doctor_workflow | BETA | Doctor | v0.2.0 |
| doctor_overlaps | BETA | Doctor | v0.2.0 |
| doctor_secrets | BETA | Doctor | v0.2.0 |
| notes_new | STABLE | Notes | v0.1.0 |
| notes_read | STABLE | Notes | v0.1.0 |
| notes_update | STABLE | Notes | v0.1.0 |
| notes_delete | STABLE | Notes | v0.1.0 |
| notes_rename | STABLE | Notes | v0.1.0 |
| notes_search | STABLE | Notes | v0.1.0 |
| notes_list | STABLE | Notes | v0.1.0 |
| notes_backlinks | STABLE | Notes | v0.1.0 |
| notes_orphans | STABLE | Notes | v0.1.0 |
| notes_code_links | STABLE | Notes | v0.1.0 |
| notes_links | STABLE | Notes | v0.1.0 |
| notes_graph | STABLE | Notes | v0.1.0 |
