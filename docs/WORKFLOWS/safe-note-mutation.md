<!-- Source: WORKFLOWS/safe-note-mutation.md | Status: CANONICAL | Stability: STABLE -->

# Safe Note Mutation Workflow

See: [../OPERATING_MODES.md](../OPERATING_MODES.md)
See: [../AGENT_OPERATING_MODEL.md](../AGENT_OPERATING_MODEL.md)

This workflow explains how note mutation is intentionally denied by default and how a trusted local developer enables it safely.

## Step 1: Start In Default MCP Mode

The normal interactive starting point is an MCP session that can read, observe, and plan:

```toml
[mcp]
policy = "default"
```

In that mode, the agent can:

- read source files
- inspect bundle plans
- search notes
- read existing notes

In that mode, the agent cannot:

- create notes
- update notes
- rename notes
- delete notes

Why this stops you: a default MCP session is for live reasoning, not silent repository mutation. The denial protects the boundary between "the agent may inspect" and "the agent may change durable knowledge."

## Step 2: See The Denial For What It Is

If the agent tries to call a note-mutation tool in default mode, that denial is expected:

```text
notes_update(id="20260419090000", body="Refined conclusion.")
```

The correct response is not to weaken policy casually. First confirm whether this session is actually trusted to change the note graph.

## Step 3: Intentionally Enable Mutation In A Trusted Local Session

When a local developer explicitly wants the agent to maintain notes, enable mutation in the MCP profile:

```toml
[mcp]
policy = "unrestricted"
enable_mutation = true
```

Then verify the effective profile:

```bash
cx doctor mcp --config cx.toml
```

Why this protects you: mutation authority becomes an explicit operator decision in versioned configuration instead of an accidental side effect of starting an MCP session.

## Step 4: Mutate Notes Deliberately

Once mutation is intentionally enabled, the agent can create or revise notes:

```text
notes_new(title="Extraction Guardrail", body="Degraded extraction must stay opt-in because coordinate trust is part of the bundle contract.", tags=["safety", "workflow"])
notes_update(id="20260419090000", body="Expanded the note with Monday-morning verification guidance.", tags=["workflow", "handoff"])
```

## Step 5: Review The Result With Graph And Audit Commands

After note mutation, review the graph instead of assuming the changes fit cleanly:

```bash
cx notes links
cx notes backlinks --id 20260419090000
cx notes graph --id 20260419090000 --depth 2
cx notes orphans
```

Use these commands to confirm:

- the edited note still links to the right concepts
- related notes point back where expected
- no unexpected orphaning happened
- the change fits the existing knowledge graph instead of fragmenting it

Why this protects you: safe mutation is not just "permission granted." It is permission plus review. The graph commands make durable knowledge auditable after the edit, not just editable during it.
