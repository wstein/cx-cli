<!-- Source: OPERATING_MODES.md | Status: CANONICAL | Stability: STABLE -->

# Choose Your Operating Mode

This is the main conceptual entrypoint for `cx`.

Choose the mode that matches the job you need to do right now.

## Use `cx mcp`

Need fast interactive AI help on live code? Use `cx mcp`.

Use it when you need:

- live workspace reads and search
- interactive reasoning over the current checkout
- note discovery and review during active work
- planning help before you freeze an artifact

This is the right choice when the workspace is still moving and you need the agent to understand what is true right now.

Workflow example: [WORKFLOWS/friday-to-monday.md](WORKFLOWS/friday-to-monday.md)

## Use `cx bundle`

Need a reproducible, promotable artifact? Use `cx bundle`.

Use it when you need:

- a deterministic handoff for CI, review, or downstream automation
- manifest, lock file, and checksum sidecar protection
- later validation and verification
- extraction under manifest and hash guardrails

This is the right choice when the work must stop being exploratory and become an artifact contract.

Workflow example: [WORKFLOWS/friday-to-monday.md](WORKFLOWS/friday-to-monday.md)

## Use `cx notes`

Need durable design memory? Use `cx notes`.

Use it when you need:

- stable architectural intent in version control
- linked repository knowledge that survives sessions
- searchable note history and graph review
- durable context for later humans and agents

This is the right choice when the reasoning itself needs to persist, not just the current task result.

Workflow example: [WORKFLOWS/safe-note-mutation.md](WORKFLOWS/safe-note-mutation.md)

## How The Modes Fit Together

These are not competing tools. They are the three operating surfaces of the same system:

1. Start with `cx mcp` when you need live understanding.
2. Record durable conclusions with `cx notes`.
3. Freeze trusted handoff state with `cx bundle`.

See: [MENTAL_MODEL.md](MENTAL_MODEL.md)
See: [WORKFLOWS/friday-to-monday.md](WORKFLOWS/friday-to-monday.md)
See: [WORKFLOWS/safe-note-mutation.md](WORKFLOWS/safe-note-mutation.md)
