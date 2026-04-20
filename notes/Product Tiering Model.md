---
id: 20260417143000
title: Product Tiering Model
tags: [architecture, mcp, stability]
target: current
---
# Product Tiering Model

cx-cli tools are organized into four stability tiers: **STABLE**, **BETA**, **EXPERIMENTAL**, and **INTERNAL**. This model lets operators understand which tools have locked APIs and which may evolve, and it now applies explicitly to the MCP surface instead of treating `cx mcp` as one undifferentiated experiment.

## Tier Guarantees

- **STABLE**: Semver-protected contract. Output schema is locked; breaking changes require major version bump.
- **BETA**: Functional but schema may change in minor releases. One release deprecation notice before removal.
- **EXPERIMENTAL**: Actively developed; subject to removal without notice.
- **INTERNAL**: Not advertised; used internally by tests and development.

## Current Distribution

- **STABLE** (18 tools): Core workspace (list, grep, read), planning (inspect, bundle), and notes lifecycle/discovery including reachable-graph inspection
- **BETA** (5 tools): Diagnostic tools (doctor_*) and experimental workspace writes (replace_repomix_span)

## Links

- [docs/modules/ROOT/pages/repository/docs/stability.adoc](../docs/modules/ROOT/pages/repository/docs/stability.adoc) — Full tier definitions, versioning policy, matrix
- [[MCP Stable Contract Boundary]] — which MCP tools are now explicitly non-experimental
- [[MCP Tool Intent Taxonomy]] — Tool capability model (read, observe, plan, mutate)
- [[Agent Operating Model]] — When each tool is used (MCP interactive vs bundle CI/CD)
