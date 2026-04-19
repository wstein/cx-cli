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

Use the smallest core set first:

- Run `cx mcp` first if you want the shortest onboarding path: see value now, learn the model later.
- [SYSTEM_MAP.md](./SYSTEM_MAP.md) - compressed front door plus contributor subsystem map
- [OPERATING_MODES.md](./OPERATING_MODES.md) - choose between live MCP help, reproducible bundles, and durable notes
- [MENTAL_MODEL.md](./MENTAL_MODEL.md) - canonical semantics, Track A vs B, MCP policy tiers, and artifact lifecycle
- [SYSTEM_CONTRACTS.md](./SYSTEM_CONTRACTS.md) - cognition contract, boundary contract, and trust propagation model
- [MANUAL.md](./MANUAL.md) - operator path, assurance ladder, and Friday-to-Monday workflow map

## Reference By Concern

- Agent setup and IDE integration: [AGENT_INTEGRATION.md](./AGENT_INTEGRATION.md)
- Agent operating rules and MCP policy consequences: [AGENT_OPERATING_MODEL.md](./AGENT_OPERATING_MODEL.md)
- Configuration knobs and precedence: [config-reference.md](./config-reference.md)
- Release-time checks and Pages publishing: [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)
- Notes system details: [NOTES_MODULE_SPEC.md](./NOTES_MODULE_SPEC.md)
- Extraction and recovery rules: [EXTRACTION_SAFETY.md](./EXTRACTION_SAFETY.md)
- Workflow examples over time: [WORKFLOWS/friday-to-monday.md](./WORKFLOWS/friday-to-monday.md), [WORKFLOWS/safe-note-mutation.md](./WORKFLOWS/safe-note-mutation.md), [WORKFLOWS/agent-note-review-loop.md](./WORKFLOWS/agent-note-review-loop.md)
- MCP debugging cockpit: `bun run test:vitest:mcp:ui`, `bun run test:vitest:mcp:adversarial:ui`
- Compact operator MCP audit view: `cx audit summary`

## Workflow Set

- [WORKFLOWS/friday-to-monday.md](./WORKFLOWS/friday-to-monday.md) - the primary end-to-end workflow from live investigation to verified handoff
- [WORKFLOWS/safe-note-mutation.md](./WORKFLOWS/safe-note-mutation.md) - the policy boundary for trusted local note mutation
- [WORKFLOWS/agent-note-review-loop.md](./WORKFLOWS/agent-note-review-loop.md) - the agent point of view for that same trusted mutation path

Read the Friday-to-Monday workflow first. The two note-mutation workflow docs
are narrower special cases, not parallel onboarding paths.

## Historical Material

- [../CHANGELOG.md](../CHANGELOG.md)
- [MIGRATIONS/0.4.0.md](./MIGRATIONS/0.4.0.md)

Use these when upgrading or reviewing release history. They are not part of the
core operator front door.

Trust shorthand for the whole docs set:

- Source tree: trusted
- Notes: conditional
- Agent output: untrusted until verified
- Bundle: trusted

## Hierarchy

- `MENTAL_MODEL.md` owns semantics.
- `OPERATING_MODES.md` maps those semantics to operator choices.
- `WORKFLOWS/*` shows execution examples.
- `AGENT_*` documents the integration layer.

Everything else should reference those layers instead of redefining them.
