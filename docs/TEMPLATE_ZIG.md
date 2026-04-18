<!-- Source: TEMPLATE_ZIG.md | Status: CANONICAL | Stability: STABLE -->

# Zig Template

The Zig `cx init` template is aimed at `build.zig`-driven repositories and is
the newest language-specific environment supported by `cx init`.

## Generated Targets

- `make build` → `zig build`
- `make test` → `zig build test`
- `make verify` → `test + build`
- `make certify` → `verify`

## MCP Overlay

The generated `cx-mcp.toml` exposes:

- `src/**`
- `build.zig`
- `build.zig.zon`
- `README.md`

It excludes `zig-cache/**`, `.zig-cache/**`, and `zig-out/**` to keep the
default MCP surface source-first.
