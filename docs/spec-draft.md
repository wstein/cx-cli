# CX Architecture Specification

This draft records the current editorial consensus for the `cx` documentation
set. Use [docs/README.md](./README.md) as the entry point.

## Operator First

The docs should lead with the actions an operator can take immediately:

1. `cx init --name demo`
2. `cx inspect --token-breakdown`
3. `cx bundle --config cx.toml`
4. `cx mcp`
5. `cx doctor mcp`
6. `cx doctor secrets`

The first page should show the working path before it explains the internal
model. Readers should be able to get a useful result without decoding the
entire architecture up front.

## Core Thesis

`cx` is a deterministic context bundler and agent workflow tool.

It exists to:

- split a project into non-overlapping sections
- render one deterministic output per section
- copy selected raw assets into the bundle
- generate a manifest and checksum file
- support `extract`, `verify`, `validate`, and `list`
- keep its own TOML configuration
- expose a native `cx mcp` server for workspace-aware agent tools

The MCP surface is intentionally separate from bundle rendering. `cx bundle`
describes the reproducible artifact contract. `cx mcp` describes the live
workspace contract that agents use while they are interacting with the repo.

## Bundle Boundary

The bundling workflow should stay strict:

- section membership must be deterministic
- overlap should fail by default
- output spans must be recorded only when they can be computed accurately
- extraction should prefer canonical recovery over approximate fallback

This strictness is not decorative. It prevents agents and operators from
building on stale or ambiguous context.

## Native MCP Surface

`cx mcp` should stay native to `cx`.

The server should expose workspace-scoped tools such as:

- `list` for file enumeration
- `grep` for content search
- `read` for anchored file inspection

These tools should operate on the current `cx` file scope, not on a separate
bundle format and not on raw OS shell commands. The agent should work against
the same deterministic workspace scope that `cx` already uses for planning.

## Notes Layer

The notes module is the human intent layer of the repository.

The docs should explain it as:

- a permanent repository knowledge layer
- a place for atomic, durable notes
- a companion to the code and config, not a task tracker
- a source of summaries and links that agents can query safely

The notes layer should be framed as part of the same operator and agent
workflow, not as an unrelated philosophical add-on.

## Implementation Order

The revision plan should stay practical:

1. keep the operator path first in README and manual docs
2. keep `cx mcp` defaulting to `cx-mcp.toml`
3. keep the MCP tools native to `cx`
4. keep the notes layer aligned with the agent workflow
5. keep the docs readable before they become exhaustive

## Editorial Goal

The documentation should help a new user answer these questions quickly:

- What command do I run first?
- What changes when I use `cx mcp` instead of `cx bundle`?
- Why does `cx` reject unsafe or ambiguous states?
- How do notes and manifests help an agent reason about the repository?

If the docs answer those questions early, the deeper architecture is much
easier to trust later.
