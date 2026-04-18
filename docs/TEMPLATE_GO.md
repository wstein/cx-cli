<!-- Source: TEMPLATE_GO.md | Status: CANONICAL | Stability: STABLE -->

# Go Template

The Go `cx init` template is intended for module-aware repositories using
`go.mod`.

## Generated Targets

- `make build` → `go build ./...`
- `make test` → `go test ./...`
- `make check` → `go vet ./...`
- `make verify` → `check + test + build`
- `make certify` → `verify`

## MCP Overlay

The generated `cx-mcp.toml` exposes:

- `cmd/**`
- `internal/**`
- `pkg/**`
- `go.mod`
- `go.sum`
- `README.md`

Adjust the overlay if your project keeps important source outside those
conventional directories.
