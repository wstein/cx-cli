---
id: 20260415153000
aliases: ["mcp note review", "live note review"]
tags: [mcp, notes, workflow]
---

When reviewing repository notes, use manifest-first selection and live MCP note tools instead of opening every Markdown file.

Start with `manifest.notes[]` or `notes_search(...)` to identify the most relevant notes, then open only those note ids with `notes_read(...)` when deeper context is required.

Use `notes_update(...)`, `notes_rename(...)`, and `notes_delete(...)` in MCP only when a review decision is confirmed. For direct repository edits or batch cleanup, use `cx notes` on disk.

This workflow keeps review work efficient, reduces token spend for agents, and preserves the durable note metadata that downstream automation depends on.

Use the Read / Observe tool grouping described in [[MCP Tool Intent Taxonomy]] when performing note review before any edits.

## Links

- [[Manifest-Side Note Summaries]] - The companion optimization for note discovery.
- [[Agentic Ecosystem MCP]] - The live provider that enables note review and edits.
- [[AI-first Toolbox]] - The operational context for query-first tooling.
- [[Note Graph Audit]] - Maintain reference integrity after renames and note changes.
