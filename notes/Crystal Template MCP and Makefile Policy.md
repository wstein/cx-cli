---
id: 20260418234100
aliases: []
tags: [templates, crystal, mcp, makefile]
---
# Crystal Template MCP and Makefile Policy

The Crystal init template is an enhanced template.

- It keeps the MCP overlay focused on `src/**`, `spec/**`, shard metadata, and
  `README.md`.
- It uses `shards build` when shard metadata is present and otherwise falls
  back to `crystal build src/main.cr --release`.
- Its local targets are `build`, `test`, `verify`, and `certify`.

## Links

- [[MCP Tool Intent Taxonomy]]
- [[Developer Command Workflow]]
- [[Elixir Template MCP and Makefile Policy]]
