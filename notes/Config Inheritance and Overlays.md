---
id: 20260415160500
aliases: ["config overlays", "inheritance"]
tags: [config, architecture, refinement]
---
`cx` configuration follows a deterministic loading and inheritance pipeline that enables colocated overlays (like `cx-mcp.toml`) without repeating the entire `cx.toml` baseline.

The `loadConfigInput` function in `src/config/load.ts` implements this logic. A configuration file can specify `extends = "base.toml"`, which triggers an recursive merge.

Key rules:
- **Base first, child second**: The parent configuration is loaded first, and the child’s values are overlaid.
- **Merge behavior**:
  - *Primitive values*: Strings, numbers, and booleans in the child replace the parent.
  - *Objects*: Merged recursively by key.
  - *Arrays*: The child array is appended to the parent array (e.g., `files.include` or `files.exclude`).
- **One-level limit**: Deep configuration chaining is forbidden (`base.toml` cannot declare `extends`). This ensures the inheritance remains readable and easy to audit with `cx doctor mcp`.
- **Active config selection**: `cx mcp` prefers `cx-mcp.toml` by default but falls back to `cx.toml` if the overlay is missing.

This mechanism allows developers to define a "production" bundle config in `cx.toml` and a more permissive or restricted overlay for live MCP sessions.

## Links

- [[VCS Master Base]] - Configuration determines how the file pool is populated.
- [[Frontmatter Validation and Duplicate ID Guard]] - Configuration defines strict validation rules.
- src/config/load.ts - Implementation of the merge and inheritance logic.
- src/config/types.ts - Type definitions for all configuration knobs.
