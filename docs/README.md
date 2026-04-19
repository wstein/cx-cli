# CX Documentation Index

Use this directory as the map for the documentation set.

Schema and coverage publishing policy lives in [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md), which keeps the public GitHub Pages host and release mirror aligned with the checked-in `schemas/` files and the successful `main` CI proof path.
Developer command conventions for `make test`, `make verify`, and `make release` live in the repository notes and the operator manual.
The MCP surface has a documented stable subset, but the broader integration layer still evolves conservatively. Use [STABILITY.md](./STABILITY.md) for the stable subset and [AGENT_INTEGRATION.md](./AGENT_INTEGRATION.md) for client-facing setup guidance.

## What Changed In 0.4.0

`cx` now explicitly operates as three cooperating surfaces:

- immutable snapshots with `cx bundle`
- live agent protocol with `cx mcp`
- durable knowledge with `cx notes`

Track B generates hypotheses. Track A generates proofs. Notes preserve durable reasoning between them.

0.4.0 also makes three release-level changes explicit:

- Vitest coverage is now the authoritative coverage-reporting lane for release assurance.
- The MCP surface has a stable subset, but the broader integration layer still evolves conservatively.
- Notes governance, cognition scoring, contradiction checks, and trust propagation are part of the operating contract rather than incidental implementation details.

See:

- [../CHANGELOG.md](../CHANGELOG.md)
- [MIGRATIONS/0.4.0.md](./MIGRATIONS/0.4.0.md)

## Start Here

- Run `cx mcp` first if you want the shortest onboarding path: see value now, learn the model later.
- [SYSTEM_MAP.md](./SYSTEM_MAP.md) - the compressed front door: where to start and how the surfaces relate
- [OPERATING_MODES.md](./OPERATING_MODES.md) - choose between live MCP help, reproducible bundles, and durable notes
- [MENTAL_MODEL.md](./MENTAL_MODEL.md) - canonical semantics, Track A vs B, MCP policy tiers, and artifact lifecycle
- [SYSTEM_CONTRACTS.md](./SYSTEM_CONTRACTS.md) - cognition contract, boundary contract, and trust propagation model
- [MANUAL.md](./MANUAL.md) - operator path, assurance ladder, and Friday-to-Monday workflow map
- `bun run test:vitest:mcp:ui` - focused MCP test/debug cockpit with Vitest UI coverage and import-graph inspection
- `bun run test:vitest:mcp:adversarial:ui` - failure-injection MCP cockpit for startup hangs and hostile runtime cases
- `cx audit summary` - compact operator view for recent MCP audit trends
- [WORKFLOWS/friday-to-monday.md](./WORKFLOWS/friday-to-monday.md) - end-to-end agent workflow from live MCP investigation to verified bundle handoff
- [WORKFLOWS/safe-note-mutation.md](./WORKFLOWS/safe-note-mutation.md) - how a trusted local developer enables note mutation and reviews the result
- [WORKFLOWS/agent-note-review-loop.md](./WORKFLOWS/agent-note-review-loop.md) - end-to-end agent note mutation and review loop with MCP plus `cx notes check`
- [ARCHITECTURE.md](./ARCHITECTURE.md) - system boundary and core decisions
- [NOTES_MODULE_SPEC.md](./NOTES_MODULE_SPEC.md) - notes system contract
- [EXTRACTION_SAFETY.md](./EXTRACTION_SAFETY.md) - extraction and recovery rules
- [MCP_TOOL_INTENT_TAXONOMY.md](./MCP_TOOL_INTENT_TAXONOMY.md) - machine-oriented prompt grouping for agent usage
- [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) - release-time schema, npm/Homebrew handoff, and Pages reminders
- [config-reference.md](./config-reference.md) - configuration knobs and precedence
- [AGENT_INTEGRATION.md](./AGENT_INTEGRATION.md) - instructions and examples for integrating `cx mcp` with IDEs and AI agents

## Hierarchy

- `MENTAL_MODEL.md` owns semantics.
- `OPERATING_MODES.md` maps those semantics to operator choices.
- `WORKFLOWS/*` shows execution examples.
- `AGENT_*` documents the integration layer.

Everything else should reference those layers instead of redefining them.
