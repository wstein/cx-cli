---
id: 20260418234200
aliases: []
tags: [templates, go, mcp, makefile]
---

# Go Template MCP and Makefile Policy

The Go init template is an enhanced template.

- It keeps the MCP overlay focused on `cmd/**`, `internal/**`, `pkg/**`,
  `go.mod`, `go.sum`, and `README.md`.
- It uses `go vet ./...` as the default `check` target.
- Its local targets are `build`, `test`, `check`, `verify`, and `certify`.
