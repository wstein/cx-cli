---
id: 20260413153301
aliases: ["duplicate-id-detection"]
tags: ["planning", "security", "invariants"]
---
During the planning phase, `cx` must enforce strict validation of Zettelkasten note frontmatter. Every note must possess a unique `id` adhering to the `YYYYMMDDHHMMSS` schema. 

This is a structural invariant for the AI-first toolbox. If duplicate IDs exist within the master file base, downstream LLM agents and extraction tools will suffer from ambiguous routing and context poisoning. By enforcing uniqueness before the bundle rendering phase, we guarantee that the resulting manifest provides a trustworthy, deterministic map for agentic traversal.

#### Links
* [[Dirty State Taxonomy]] - Validation occurs after dirty-state classification but before rendering.
* [[AI-first Toolbox]] - Strict metadata is required for safe agentic context routing.
