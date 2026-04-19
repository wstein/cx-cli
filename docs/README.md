# CX Documentation Index

Use this directory as the map for the documentation set.

Schema publishing policy lives in [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md), which keeps the public GitHub Pages host and release mirror aligned with the checked-in `schemas/` files.
Developer command conventions for `make test`, `make verify`, and `make release` live in the repository notes and the operator manual.

## Start Here

- [MENTAL_MODEL.md](./MENTAL_MODEL.md) - canonical CX triad, Track A vs B, MCP policy tiers, and artifact lifecycle
- [MANUAL.md](./MANUAL.md) - quick operator path and Friday-to-Monday workflow map
- [WORKFLOWS/friday-to-monday.md](./WORKFLOWS/friday-to-monday.md) - end-to-end agent workflow from live MCP investigation to verified bundle handoff
- [ARCHITECTURE.md](./ARCHITECTURE.md) - system boundary and core decisions
- [NOTES_MODULE_SPEC.md](./NOTES_MODULE_SPEC.md) - notes system contract
- [EXTRACTION_SAFETY.md](./EXTRACTION_SAFETY.md) - extraction and recovery rules
- [MCP_TOOL_INTENT_TAXONOMY.md](./MCP_TOOL_INTENT_TAXONOMY.md) - machine-oriented prompt grouping for agent usage
- [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) - release-time schema, npm/Homebrew handoff, and Pages reminders
- [config-reference.md](./config-reference.md) - configuration knobs and precedence
- [AGENT_INTEGRATION.md](./AGENT_INTEGRATION.md) - instructions and examples for integrating `cx mcp` with IDEs and AI agents
