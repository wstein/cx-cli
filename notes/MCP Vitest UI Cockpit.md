---
id: 20260419162000
aliases: ["MCP Test Debug Cockpit", "Vitest UI MCP Cockpit"]
tags: ["testing", "mcp", "vitest", "workflow"]
target: current
---
The MCP test and debug cockpit is a dedicated Vitest UI entrypoint for the MCP-heavy suite, not a generic replacement for the Bun lanes. It exists so operators can rerun MCP failures interactively, inspect coverage inside the UI, and trace slow startup or policy-registration paths without dragging the full repository test surface into every debugging session.

This cockpit is intentionally scoped to the MCP boundary:

- `tests/mcp/**` for server lifecycle, runtime faults, and adversarial transport behavior
- `tests/cli/mcp*.test.ts` for CLI-facing MCP registration and denial surfaces
- selected `tests/unit/mcp*.test.ts` and doctor-report tests for policy, audit, and registration helpers

That makes the UI useful for the failure classes that matter later:

- policy gating bugs
- startup hangs or degraded startup paths
- malformed tool-runtime behavior
- suspicious import or registration cost inside `src/mcp/**`

The operator workflow is simple:

1. Run `bun run test:vitest:mcp:ui`.
2. Re-run only the failing MCP slice.
3. Use the UI coverage and import graph to identify whether the issue is in transport, policy, registration, or CLI wiring.

This does not replace Track A proof or the Bun verification lanes. It is a Track B debugging cockpit for the live MCP subsystem.

## Links

- [[Test Strategy Hardening]] - MCP boundary failures should stay explicit and adversarial.
- [[Developer Command Workflow]] - the cockpit belongs in the local operator command set.
- [[MCP Adversarial Test Cockpit]] - use the narrower lane for hostile-boundary failures.
- [[MCP Tool Intent Taxonomy]] - policy and capability bugs are a core cockpit use case.
- [[MCP Transport Protocol]] - server lifecycle and stdio behavior are the runtime boundary under inspection.
- [[MCP Vitest UI Troubleshooting]] - quick failure-mode mapping for operators.
