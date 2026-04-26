---
id: 20260419171500
aliases: ["MCP Cockpit Troubleshooting", "Vitest UI MCP Troubleshooting"]
tags: ["mcp", "troubleshooting", "vitest", "workflow"]
---
The MCP Vitest UI troubleshooting flow is intentionally small: use the broad MCP cockpit when you need coverage and import visibility across the MCP boundary, and switch to the adversarial cockpit when the failure is explicitly about startup breakdowns, malformed runtime payloads, or other hostile-boundary behavior. The goal is to shorten diagnosis, not to replace the normal proof path.

Three recurring cases matter most:

- startup hangs or boot failures: prefer `bun run test:vitest:mcp:adversarial` or `bun run test:vitest:mcp:adversarial:ui`
- policy denials or capability surprises: use `bun run test:vitest:mcp` and inspect the denial-facing MCP tests plus `cx doctor mcp --json`
- slow imports or startup cost: use `bun run test:vitest:mcp:ui` and inspect the import graph around `src/mcp/**` and `src/cli/commands/mcp.ts`

The cockpit answers "where is the failure living?" Once that is clear, promote the fix through the normal Bun verification and CI lanes.

## Links

- [[MCP Vitest UI Cockpit]] - broad MCP debug cockpit
- [[MCP Adversarial Test Cockpit]] - failure-injection lane
- [[MCP Import Graph Diagnostics]] - import-cost diagnosis
