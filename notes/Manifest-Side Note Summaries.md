---
id: 20260413153522
aliases: ["manifest-summaries"]
tags: ["manifest", "ai-tools", "optimization"]
target: current
---
# Manifest-Side Note Summaries

`cx` stores high-level note summaries in the manifest JSON. Downstream agents
read those summaries directly instead of parsing every note body first.

The manifest is a structured index for the repository's cognition layer.
Agents can scan architectural intent, evaluate constraints, and fetch deeper
context only when they need it. The live MCP workflow stays focused on
navigation rather than re-parsing note bodies.

## Before and After

Before manifest-side summaries:

- the agent opens the bundle
- it sees a `notes/` directory but does not know which files matter
- it reparses raw Markdown notes to discover relevant decisions
- token use and latency scale with note count instead of task relevance

After manifest-side summaries:

- the agent reads `manifest.notes[]`
- it filters by stable note id, title, alias, or summary text
- it opens only the notes tied to the current task
- token use and latency stay closer to the real scope of the request

This is the mechanical win: the manifest converts note discovery from an
unbounded Markdown scan into a structured metadata query.

That only works when note quality stays high. Summary-first routing depends on notes remaining atomic, bounded in size, and explicit enough to preserve signal-to-noise for later agents.

This manifest-driven discovery pattern is a key part of the Track B live
agent workflow while preserving the same durable metadata contract used by
Track A. See [[Operational Bifurcation]].

## Links

- [[Agentic Ecosystem MCP]] - External tools consume these summaries through
  the native CX MCP server and its file-based tools.
- [[Repository Cognition Layer]] - The note graph must stay high-signal for summary-first routing to remain trustworthy.
- [[VCS Master Base]] - Summaries are derived securely from the VCS-tracked
  master list.
- [[Token Accounting]] - Token counts are recorded in the same manifest metadata.
