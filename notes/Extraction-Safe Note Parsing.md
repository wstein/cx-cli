---
id: 20260413153415
aliases: ["note-parsing", "ai-routing"]
tags: ["extraction", "ai-tools"]
---

# Extraction-Safe Note Parsing

Note parsing for the AI-first toolbox must be extraction-safe. When `cx`
routes YAML frontmatter downstream to AI agents, it must do so without
compromising the deterministic file recovery guarantees of the original
markdown files.

Agents require structured metadata (IDs, aliases, tags) to traverse the
repository's knowledge graph natively. However, `cx` is an operational
bundler and native MCP workspace toolset, not just an exploratory packager.
Therefore, the parser must isolate the structured metadata for the agent while
leaving the packed normalized representation intact. If extraction mechanisms
mutate the markdown to serve the AI, it fundamentally breaks the line-span
coordinates and hash verifiability of the original file.

## Links

- [[Extraction Safety]] - Mutating content during parsing breaks
  cryptographic invariants.
- [[AI-first Toolbox]] - AI workflows rely on parsed data, but operational
  recovery relies on the raw bundle.
