---
id: 20260419104000
aliases: ["Operating Mode Hub", "Choose Your Operating Mode"]
tags: ["architecture", "workflow", "docs"]
---
`cx` needs a single front-door explanation that tells operators which surface to use before they learn the deeper internals.

The chooser is simple:

1. Use `cx mcp` when the need is live interactive reasoning over the current workspace.
2. Use `cx bundle` when the need is a reproducible artifact that can be promoted, verified, and trusted later.
3. Use `cx notes` when the need is durable design memory that should survive the current session.

This framing matches the architecture instead of competing with it. The triad stays the same, but the operator first sees the decision they actually need to make: "Which mode fits the job in front of me?"

The operating-mode hub should be the main conceptual entrypoint in `docs/` and then hand readers off to the deeper mental model, architecture, and agent operating model documents.

## Links
* [[CX Triad]]
* [[Operational Bifurcation]]
* [[Agent Operating Model]]
