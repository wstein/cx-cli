---
id: 20260415171000
aliases: ["Pipeline vs Laboratory", "Track A/B"]
tags: ["architecture", "workflow"]
---
`cx` uses a unified deterministic identity model but bifurcates operation into two distinct paths: Track B generates hypotheses against live state, while Track A generates proof that can survive review, CI, and handoff.

1. **Track A: Pipeline Operations** (the "Factory Floor")
   - `cx bundle`, `cx verify`, `cx extract`, `cx validate`
   - produces immutable, verifiable artifacts for CI/CD and handoff
   - enforces strict bundle invariants and exact metadata

2. **Track B: Live Agent Exploration** (the "Laboratory")
   - `cx mcp`, `cx notes`, `cx doctor mcp`
   - exposes the workspace for active agent search, note maintenance, and live planning
   - preserves the same file scope, config overlay, and safety boundary as Track A

The two tracks share:

- a single workspace boundary defined by `cx.toml` / `cx-mcp.toml`
- the same deterministic planning and VCS-derived master file base
- the same manifest metadata model for token counts, checksums, and notes
- the same hard-stop safety invariants around overlap, dirty state, and extraction

The notes layer sits between them as the durable cognition layer. It preserves high-signal reasoning discovered in Track B so Track A artifacts can carry that reasoning forward without rediscovering it from raw code.

This bifurcation helps operators choose the correct path for their immediate goal while keeping the underlying contract consistent.

## Links
* [[Agentic Ecosystem MCP]]
* [[Config Inheritance and Overlays]]
* [[Repository Cognition Layer]]
* [[MCP Tool Intent Taxonomy]]
* [[MCP Transport Protocol]]
* [[CX Triad]]
* [[Token Accounting]]
