---
id: 20260419112000
aliases: ["Trusted note mutation", "Note mutation review"]
tags: ["mcp", "notes", "workflow", "policy"]
status: current
---
Safe note mutation is a two-part workflow: explicit authority first, graph review second.

The default MCP experience is intentionally non-mutating for note writes. That keeps an exploratory session from crossing into durable repository edits by accident.

When a trusted local developer really does want the agent to maintain notes, the session must opt into:

- `policy = "unrestricted"`
- `enable_mutation = true`

After mutation, graph and audit commands are part of the workflow, not optional cleanup. `cx notes links`, `cx notes backlinks`, `cx notes graph`, and `cx notes orphans` confirm that the note change still fits the repository knowledge graph.

## Links
* [[Agent Operating Model]]
* [[MCP Tool Intent Taxonomy]]
* [docs/WORKFLOWS/safe-note-mutation.md](../docs/WORKFLOWS/safe-note-mutation.md)
