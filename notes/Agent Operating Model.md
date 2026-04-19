---
id: 20260417150000
title: Agent Operating Model
tags: [architecture, mcp, operations, policy]
target: current
---
# Agent Operating Model

cx-cli provides three complementary workflows: **Bundle** (immutable snapshots), **MCP** (live interactive), and **Notes** (durable knowledge). Each serves a different use case and has distinct policy guarantees.

## Three Workflows

- **Bundle**: Pre-computed, reproducible context. Used in CI/CD pipelines. Read-only; no policy control needed.
- **MCP**: Live tools (read files, search, inspect, manage notes). Policy-driven access control (strict/default/unrestricted).
- **Notes**: Persistent knowledge graph. Atomic, interlinked notes in version control. Queryable and auditable.

## Policy Tiers

MCP tools are gated by four capability tiers (read, observe, plan, mutate). Policies control which capabilities agents have:

- **strict** (CI/CD): read + observe only
- **default** (interactive): read + observe + plan
- **unrestricted** (local): mutate-capability tools only when `enable_mutation = true`

The operational point is that an exploratory MCP session is not automatically a mutation-authorized session. Note writes and other mutate-capability tools stay denied until the local operator explicitly enables them.

## Links

- [docs/AGENT_OPERATING_MODEL.md](../docs/AGENT_OPERATING_MODEL.md) — Full operating model with decision matrix and examples
- [docs/GOVERNANCE.md](../docs/GOVERNANCE.md) — Documentation governance and source-of-truth markers
- [[MCP Tool Intent Taxonomy]] — Tool categorization and intent (read, observe, plan, mutate)
- [[Product Tiering Model]] — Stability contracts (STABLE, BETA, EXPERIMENTAL, INTERNAL)
