---
id: 20260418234400
aliases: []
tags: [templates, zig, mcp, makefile]
---

# Zig Template MCP and Makefile Policy

The Zig init template is an enhanced template and the newest supported
language-specific environment.

- Detection is based on `build.zig` or `build.zig.zon`.
- The default MCP overlay is source-first and excludes Zig cache and output
  directories.
- Its local targets are `build`, `test`, `verify`, and `certify`.
