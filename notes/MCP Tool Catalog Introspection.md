---
id: 20260419180000
title: MCP Tool Catalog Introspection
aliases: []
tags: [mcp, automation, stability]
---

The machine-readable MCP contract should expose tool stability metadata through `cx doctor mcp --json`, not only through human-facing prose in docs or tool descriptions. That gives external automation one stable operator command it can call to discover the current tool set, capability tiers, and stability tiers without scraping text.

This matters because the stable subset of MCP is now a product contract, not just a naming convention. Automation needs a deterministic catalog shape if it will decide which tools are safe for long-lived integrations and which ones still require defensive parsing or tighter version pinning.

How to apply it:

- expose a versioned tool catalog in `cx doctor mcp --json`
- include each tool name, capability, and stability tier
- include summary counts so operators can inspect the surface quickly without parsing every entry

## Links

- [src/doctor/mcp.ts](../src/doctor/mcp.ts)
- [src/mcp/tools/catalog.ts](../src/mcp/tools/catalog.ts)
- [docs/STABILITY.md](../docs/STABILITY.md)
- [[MCP Stable Contract Boundary]]
- [[Product Tiering Model]]
