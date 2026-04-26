---
id: 20260418213000
aliases: []
tags: [templates, typescript, mcp, makefile]
---
# TypeScript Template MCP and Makefile Policy

The TypeScript init template is intentionally source-first for MCP and
lockfile-first for package-manager selection.

## Why

TypeScript workspaces vary widely in output layout. A generated MCP overlay
that only includes `dist/src/**` is too narrow for many real repositories and
biases live agent workflows toward compiled artifacts instead of source
authoring.

The generated `Makefile` must not choose Bun merely because Bun is installed on
the machine. Repository lockfiles are the authoritative signal for
package-manager selection.

The generated `Makefile` also keeps `install` separate from `build`. Build
commands should not implicitly mutate dependency state.

## Policy

- MCP overlay defaults to source-oriented visibility for TypeScript
  repositories.
- Package manager selection is lockfile-first.
- `install`, `build`, `test`, `check`, `lint`, `verify`, and `certify` are the
  normalized TypeScript template targets.
- `lint` and `check` skip with a clear message when the corresponding package
  scripts are not defined.
- `certify` falls back to `verify` unless the workspace defines a stricter
  package-manager `certify` script.
- The default authoring overlay remains source-oriented, and compiled-output
  inspection is exposed through the separate generated `cx-mcp-build.toml`
  overlay.

## Links

- [[CLI Command Lifecycle]]
- [[Agent Operating Model]]
- [[MCP Tool Intent Taxonomy]]
- `src/templates/init/typescript/Makefile.hbs`
- `src/templates/init/typescript/cx-mcp.toml.hbs`
- `src/templates/init/typescript/cx-mcp-build.toml.hbs`
