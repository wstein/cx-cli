---
id: 20260413153415
aliases: ["note-parsing", "ai-routing"]
tags: ["extraction", "ai-tools"]
status: current
---
# Extraction-Safe Note Parsing

`cx` parses note frontmatter for AI workflows without changing the stored note
content. YAML metadata can move into agent-facing structures, but the source
markdown must remain recoverable from the rendered output.

Agents require structured metadata such as IDs, aliases, and tags to traverse
the repository's knowledge graph. `cx` keeps that metadata separate from the
stored markdown text so extraction can still rely on line spans and hashes.

## Links

- [[Bundle Extraction Safety Invariants]] - Mutating content during parsing breaks cryptographic invariants.
- [[AI-first Toolbox]] - AI workflows rely on parsed metadata, but operational
  recovery relies on the rendered bundle output.
