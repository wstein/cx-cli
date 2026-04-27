---
id: 20260419104000
aliases: ["Operating Mode Hub", "Choose Your Operating Mode"]
tags: ["architecture", "workflow", "docs"]
---
`cx` needs a single front-door explanation that tells operators which surface to use before they learn the deeper internals.

The best onboarding path is progressive:

1. Run `cx mcp`.
2. Watch the agent work against live code.
3. Then explain Track B as hypothesis generation, Track A as proof generation, and notes as the durable cognition layer.

The chooser is simple:

1. Use `cx bundle`, `cx validate`, `cx verify`, `cx extract`, or `cx list` when the need is a reproducible proof artifact.
2. Use `cx mcp` when the need is live interactive reasoning over the current workspace.
3. Use `cx notes` when the need is durable design memory that should survive the current session.
4. Use `cx adapter` or `cx render` when the need is expert adapter/oracle diagnostics.

This framing matches the canonical system map and mental model instead of
competing with them. The triad stays the same, but the operator first sees the
decision they actually need to make: "Which mode fits the job in front of me?"

The docs front door now presents this as Run and Understand. Run is the command path; Understand is the architectural explanation behind the same choice.

The operating-mode hub should be the main conceptual entrypoint in `docs/` and
then hand readers off to the system map, mental model, and agent operating
model documents.

## Links
* [[CX Triad]]
* [[Operational Bifurcation]]
* [[Repository Cognition Layer]]
* [[Agent Operating Model]]
* [[Four-Path Vocabulary Lock]]
