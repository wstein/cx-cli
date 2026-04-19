---
id: 20260418234000
aliases: []
tags: [templates, elixir, mcp, makefile]
target: current
---
# Elixir Template MCP and Makefile Policy

The Elixir init template is an enhanced template.

- It keeps the default MCP overlay focused on `lib/**`, `test/**`, `mix.exs`,
  `mix.lock`, and `README.md`.
- It excludes `_build/**`, `deps/**`, and coverage output from the default
  authoring view.
- Its local targets are `build`, `test`, `check`, `verify`, and `certify`.

## Links

- [[MCP Tool Intent Taxonomy]]
- [[Developer Command Workflow]]
- [[Crystal Template MCP and Makefile Policy]]
