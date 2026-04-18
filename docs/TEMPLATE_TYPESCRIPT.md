<!-- Source: TEMPLATE_TYPESCRIPT.md | Status: CANONICAL | Stability: STABLE -->

# TypeScript Template

The TypeScript `cx init` template is designed to be source-first for authoring
workflows and lockfile-first for package-manager selection.

## Package Manager Detection

The generated `Makefile` chooses a package manager in this order:

1. `bun.lockb` or `bun.lock`
2. `pnpm-lock.yaml`
3. `yarn.lock`
4. `package-lock.json` or `npm-shrinkwrap.json`
5. `npm` when no lockfile exists

This avoids choosing Bun only because it happens to be installed on the local
machine.

## Generated Targets

The TypeScript `Makefile` normalizes these targets:

- `make install`
- `make build`
- `make test`
- `make check`
- `make lint`
- `make verify`

`install` is intentionally separate from `build`. Build commands should not
implicitly mutate dependency state.

## MCP Overlays

`cx init --template typescript` generates two MCP overlays:

- `cx-mcp.toml`
  Source-oriented authoring overlay for `src/**`, workspace metadata, and key
  TypeScript config files.
- `cx-mcp-build.toml`
  Build-artifact overlay for `dist/**` plus minimal package metadata.

Use the source-oriented overlay for live editing and code understanding. Use the
build overlay when you want to inspect emitted artifacts without broadening the
default authoring surface.

## When To Customize

Adjust the generated overlays if your repository:

- uses a source root other than `src/`
- emits artifacts outside `dist/`
- stores important workspace metadata in additional files
- needs stricter excludes for framework-specific caches
