---
id: 20260413123400
aliases: ["active ecosystem", "MCP ecosystem"]
tags: [cx, ai, mcp]
---

# Agentic Ecosystem MCP

The repository participates in agentic workflows as well as bundle rendering.
`cx mcp` starts the native CX MCP server with `cx-mcp.toml` when present,
`cx doctor mcp` shows the inherited MCP scope, and `cx doctor secrets` scans
the master list before an agent trusts the workspace. The server exposes native
`list`, `grep`, and `read` tools for workspace-bound navigation.

The MCP path is `cx`-native. It uses the active `cx` workspace scope, the
MCP-specific `cx-mcp.toml` profile when available, and the native doctor checks
to keep agent access deterministic.

## Links

- [[AI-first Toolbox]] - This is the external tooling layer of the same philosophy.
- [[VCS Master Base]] - Queryable context still starts from a deterministic file base.
- [[Dirty State Taxonomy]] - External agents need the same safety signals as humans.
