---
id: 20260415153500
aliases: ["note graph audit", "note graph maintenance"]
tags: [notes, graph, audit]
---

A note graph audit is the practice of checking note references, backlinks, orphans, and code links after the note corpus changes.

Use `cx notes links`, `cx notes backlinks --id ...`, `cx notes orphans`, and `cx notes code-links --id ...` to find unresolved links, isolated notes, and code references that need review.

Perform this audit after note renames, note deletions, or when adding new notes that should be connected to the existing graph.

## Links

- [[Frontmatter Validation and Duplicate ID Guard]] - Keeping note metadata stable and machine-readable.
- [[Agentic Ecosystem MCP]] - MCP provides the live tooling that makes graph audit practical.
- [[Manifest-Side Note Summaries]] - Use manifest summaries to decide which notes to inspect first.
- [[MCP Note Review Workflow]] - The review flow that uses manifest-first selection and live MCP note tools.
