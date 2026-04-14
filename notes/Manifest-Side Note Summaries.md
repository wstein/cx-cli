---
id: 20260413153522
aliases: ["manifest-summaries"]
tags: ["manifest", "ai-tools", "optimization"]
---

# Manifest-Side Note Summaries

`cx` stores high-level note summaries in the manifest JSON. Downstream agents
read those summaries directly instead of parsing every note body first.

The manifest is a structured index for the repository's knowledge layer.
Agents can scan architectural intent, evaluate constraints, and fetch deeper
context only when they need it. The live MCP workflow stays focused on
navigation rather than re-parsing note bodies.

## Links

- [[Agentic Ecosystem MCP]] - External tools consume these summaries through
  the native CX MCP server and its file-based tools.
- [[VCS Master Base]] - Summaries are derived securely from the VCS-tracked
  master list.
