<!-- Source: TEMPLATE_CRYSTAL.md | Status: CANONICAL | Stability: STABLE -->

# Crystal Template

The Crystal `cx init` template is designed for `shard.yml` workspaces with a
small, source-oriented MCP surface.

## Generated Targets

- `make build` → `shards build` when shard metadata exists, otherwise
  `crystal build src/main.cr --release`
- `make test` → `crystal spec`
- `make verify` → `test + build`
- `make certify` → `verify`

## MCP Overlay

The generated `cx-mcp.toml` exposes:

- `src/**`
- `spec/**`
- `shard.yml`
- `shard.lock`
- `README.md`

It excludes dependency and build caches such as `.shards/**`, `lib/**`, and
`bin/**`.
