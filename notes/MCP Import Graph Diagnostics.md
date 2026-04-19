---
id: 20260419162500
aliases: ["MCP Import Timing Diagnostics", "MCP Module Graph Review"]
tags: ["mcp", "performance", "testing", "architecture"]
status: current
---
Vitest UI is unusually valuable for MCP performance investigation because the MCP stack is registration-heavy and spread across `src/cli/commands/mcp.ts`, `src/mcp/server.ts`, `src/mcp/policy.ts`, `src/mcp/workspace.ts`, and the tool-registration layer in `src/mcp/tools/**`. A focused UI run makes import cost and module-graph shape visible at the exact boundary where startup latency or policy bugs surface.

The useful question is not just “did the server start?” It is “which module path or registration branch made startup slow, fragile, or confusing?” That is why the dedicated MCP cockpit should keep a narrow include set and its own coverage directory instead of piggybacking on the broad repository coverage lane.

Operationally, the import graph helps with three classes of later problems:

- a new tool registration unexpectedly drags in heavy code during startup
- a policy or audit helper introduces slow imports on every MCP launch
- an MCP CLI change alters the server boot path but hides the cost inside a broad test run

This is a debugging surface, not a promotion gate. Use it to localize MCP startup and registration behavior before promoting a fix through the normal Bun and CI proof lanes.

## Links

- [[MCP Vitest UI Cockpit]] - the focused operator entrypoint.
- [[MCP Transport Protocol]] - startup and transport lifecycle under diagnosis.
- [[MCP Tool Intent Taxonomy]] - tool registration and capability metadata shape the graph.
- [[Test Strategy Hardening]] - performance and degraded-boundary failures should stay observable.
