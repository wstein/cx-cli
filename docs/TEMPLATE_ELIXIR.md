<!-- Source: TEMPLATE_ELIXIR.md | Status: CANONICAL | Stability: STABLE -->

# Elixir Template

The Elixir `cx init` template is optimized for Mix-based applications with a
source-first MCP overlay.

## Generated Targets

- `make build` → `mix compile`
- `make test` → `mix test`
- `make check` → `mix format --check-formatted`
- `make verify` → `check + test + build`
- `make certify` → `verify`

## MCP Overlay

The generated `cx-mcp.toml` exposes:

- `lib/**`
- `test/**`
- `mix.exs`
- `mix.lock`
- `README.md`

It excludes `_build/**`, `deps/**`, and coverage output so MCP stays focused on
authoring files by default.
