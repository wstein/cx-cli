---
id: 20260419170000
aliases: ["MCP Adversarial Cockpit", "MCP Failure Injection Lane"]
tags: ["mcp", "testing", "adversarial", "vitest"]
---
The MCP adversarial cockpit is a narrower Vitest lane for failure injection, startup breakdowns, malformed runtime payloads, and other hostile-boundary scenarios that should stay easy to rerun without dragging the broader MCP test surface along with them. It exists alongside the general MCP cockpit, not instead of it.

Use this lane when the question is not "does MCP work?" but "how does MCP fail under pressure?" That includes:

- startup hangs and server boot failures
- malformed tool-runtime payloads
- interrupted or degraded runtime responses
- boundary behavior that is intentionally hostile or broken

The operator entrypoints are:

1. `bun run test:vitest:mcp:adversarial`
2. `bun run test:vitest:mcp:adversarial:ui`

This keeps adversarial debugging isolated while still letting the broader Vitest coverage lane measure more of the MCP subsystem than the original unit-contract-config-only surface.

## Links

- [[MCP Vitest UI Cockpit]] - broader MCP debug cockpit
- [[MCP Import Graph Diagnostics]] - import-cost and graph inspection
- [[Test Strategy Hardening]] - adversarial boundaries should remain explicit
