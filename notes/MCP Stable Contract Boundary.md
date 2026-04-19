---
id: 20260419143000
title: MCP Stable Contract Boundary
aliases: []
tags: [mcp, stability, contract]
target: current
---
The `cx mcp` surface is no longer treated as one blanket experiment. The stable contract now covers the semver-protected workspace read tools, bundle planning tools, and the durable notes graph and note lifecycle and read tools, while doctor diagnostics and live workspace span replacement remain beta.

This matters because operator docs, MCP descriptions, and policy tests should all answer the same question the same way: which tools are safe to automate against across minor releases, and which ones still need defensive parsing or version pinning.

How to apply it:

- read stability from the MCP catalog metadata rather than a partial side map
- treat stable tools as the non-experimental automation contract
- keep beta tools explicit in docs so operators do not confuse “available” with “semver-locked”

## Links

- [docs/STABILITY.md](../docs/STABILITY.md)
- [docs/AGENT_INTEGRATION.md](../docs/AGENT_INTEGRATION.md)
- [src/mcp/tools/catalog.ts](../src/mcp/tools/catalog.ts)
- [[Product Tiering Model]]
- [[Agent Operating Model]]
