---
id: 20260413153301
aliases: ["duplicate-id-detection"]
tags: ["planning", "security", "invariants"]
---
# Frontmatter Validation and Duplicate ID Guard

`cx` validates note frontmatter during planning. Every note must carry a unique
`id` that matches the `YYYYMMDDHHMMSS` schema.

Duplicate IDs are a hard error because they make the repository knowledge graph
ambiguous for both humans and agents. Validation happens before rendering so
the manifest always reflects a deterministic note map.

## Links

- [[Dirty State Taxonomy]] - Validation runs after dirty-state classification
  and before rendering.
- [[AI-first Toolbox]] - Strict metadata keeps agentic context routing stable.
