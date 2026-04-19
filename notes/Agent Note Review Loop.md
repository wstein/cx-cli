---
id: 20260419164500
aliases: ["Agent review loop", "Notes mutation review loop"]
tags: ["mcp", "notes", "workflow", "review"]
target: current
---
Agent-driven note mutation is a full review loop, not a single write operation: inspect through MCP first, enable mutation intentionally, write durable notes, then run `cx notes check` and graph review before trusting the updated cognition layer.

The important boundary is temporal as much as technical. An agent can form hypotheses in MCP quickly, but durable note quality is only proven after the same graph and governance checks that later humans and CI will rely on.

The practical sequence is:

- read live code and prior notes
- mutate only in a trusted local session
- run `cx notes check`
- inspect graph reachability and backlinks

That keeps note mutation auditable instead of treating the write itself as proof of quality.

## Links

- [[Safe Note Mutation Workflow]] - explicit mutation authority and audit path.
- [[Repository Cognition Layer]] - why note quality is a project integrity concern.
- [docs/WORKFLOWS/safe-note-mutation.md](../docs/WORKFLOWS/safe-note-mutation.md) - canonical workflow with both operator and agent viewpoints.
