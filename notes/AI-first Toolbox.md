---
id: 20260413123000
aliases: ["AI-first toolbox", "developer-friendly AI-first toolbox"]
tags: [cx, tooling, ai]
---
# AI-first Toolbox

`cx` now includes an AI-first toolbox alongside the deterministic packaging
flow. The current surface includes note graph queries, manifest-side note
summaries, native MCP workspace tools, and a docs split that keeps durable
knowledge separate from the operator workflow.

The goal is operational efficiency, not abstract theory: agents should spend
tokens on the specific code or note they need, not on rediscovering repository
structure from scratch each time.

This approach fits the bifurcated CX workflow: Track A for deterministic
pipeline artifacts and Track B for agent-centric exploration. See
[[Operational Bifurcation]].

## Links

- [[VCS Master Base]] - The planner still starts from the VCS-derived file set.
- [[Dirty State Taxonomy]] - Safety rules keep the AI-first surface trustworthy.
- [[Agentic Ecosystem MCP]] - External tools inspect the live workspace and ask
  for more context through the native MCP server.
