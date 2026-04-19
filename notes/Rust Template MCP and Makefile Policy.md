---
id: 20260418234300
aliases: []
tags: [templates, rust, mcp, makefile]
status: current
---
# Rust Template MCP and Makefile Policy

The Rust init template is an enhanced template.

- It keeps the default authoring overlay focused on Cargo source and metadata.
- It excludes `target/**` from MCP by default.
- Its local targets are `build`, `test`, `check`, `verify`, and `certify`.

## Links

- [[MCP Tool Intent Taxonomy]]
- [[Developer Command Workflow]]
- [[Go Template MCP and Makefile Policy]]
