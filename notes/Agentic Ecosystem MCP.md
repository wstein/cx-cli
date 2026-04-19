---
id: 20260413123400
aliases: ["active ecosystem", "MCP ecosystem"]
tags: [cx, ai, mcp]
status: current
---
# Agentic Ecosystem MCP

The repository participates in agentic workflows as well as bundle rendering.
`cx mcp` starts the native CX MCP server with `cx-mcp.toml` when present,
`cx doctor mcp` shows the inherited MCP scope, and `cx doctor secrets` scans
the master list before an agent trusts the workspace. The server exposes native
`list`, `grep`, and `read` tools for workspace-bound navigation.

The MCP path is `cx`-native. It uses the active `cx` workspace scope, the
`cx-mcp.toml` overlay when available, and the native doctor checks to keep
agent access deterministic.

This architecture intentionally bifurcates operation into a Track A "Factory
Floor" pipeline and a Track B "Laboratory" live exploration path, while keeping
the same deterministic workspace boundary and manifest invariants.

In practice, the efficient path is manifest first, file reads second. Agents
should inspect manifest note summaries, locate the stable timestamp ids that
match the task, and then open only those notes through MCP. That lowers token
cost and avoids repeating a full Markdown scan on every run.

## Links

- [[Operational Bifurcation]]
- [[MCP Tool Intent Taxonomy]]
- [[AI-first Toolbox]] - This is the external tooling layer that keeps agent work queryable and efficient.
- [[VCS Master Base]] - Queryable context still starts from a deterministic file base.
- [[Dirty State Taxonomy]] - External agents need the same safety signals as humans.
