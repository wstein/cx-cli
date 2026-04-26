---
id: 20260419180000
title: MCP Tool Catalog Introspection
aliases: []
tags: [mcp, automation, stability]
---
The machine-readable MCP contract should expose tool stability metadata through a narrow operator command, not only through human-facing prose in docs or tool descriptions. `cx mcp catalog --json` now serves as that dedicated endpoint, while `cx doctor mcp --json` embeds the same catalog when operators also need profile and audit context.

This matters because the stable subset of MCP is now a product contract, not just a naming convention. Automation needs a deterministic catalog shape if it will decide which tools are safe for long-lived integrations and which ones still require defensive parsing or tighter version pinning.

How to apply it:

- expose a versioned tool catalog in `cx mcp catalog --json`
- include each tool name, capability, and stability tier
- include summary counts so operators can inspect the surface quickly without parsing every entry

## Links

- [src/doctor/mcp.ts](../src/doctor/mcp.ts)
- [src/cli/commands/mcp.ts](../src/cli/commands/mcp.ts)
- [src/mcp/tools/catalog.ts](../src/mcp/tools/catalog.ts)
- [docs/modules/ROOT/pages/repository/docs/governance.adoc](../docs/modules/ROOT/pages/repository/docs/governance.adoc)
- [[MCP Stable Contract Boundary]]
- [[Product Tiering Model]]
