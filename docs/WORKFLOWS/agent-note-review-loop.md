<!-- Source: WORKFLOWS/agent-note-review-loop.md | Status: CANONICAL | Stability: STABLE -->

# Agent Note Review Loop

See: [../AGENT_INTEGRATION.md](../AGENT_INTEGRATION.md)
See: [../AGENT_OPERATING_MODEL.md](../AGENT_OPERATING_MODEL.md)
See: [safe-note-mutation.md](safe-note-mutation.md)

This workflow shows the agent point of view for a trusted local note-mutation session from first MCP call to final governance review.

## Step 1: Start With Live Context

The operator starts the live server first:

```bash
cx mcp
```

The agent begins in hypothesis-generation mode and inspects the current repository state before changing durable knowledge.

Typical MCP sequence:

```text
doctor_mcp()
notes_search(query="dirty state", limit=5)
notes_read(id="20260413153522")
read(path="src/cli/commands/bundle.ts", startLine=220, endLine=280)
inspect()
```

Why this protects you: the agent reads the current code, prior notes, and the bundle plan before proposing new durable reasoning.

## Step 2: Intentionally Enable Mutation

If the operator wants the agent to update notes, mutation must be enabled deliberately:

```toml
[mcp]
policy = "unrestricted"
enable_mutation = true
```

The agent can then move from read/plan into durable note maintenance.

Why this protects you: the session crosses from exploration into mutation only through an explicit trust decision.

## Step 3: Mutate Notes Through MCP

With mutation enabled, the agent can create or refine the cognition layer directly:

```text
notes_new(
  title="Dirty State Review Loop",
  body="Dirty-state refusal protects the proof path by stopping Track A from claiming artifact certainty while tracked code is still moving.\n\n## What\n\nTrack A must refuse a promotable bundle when tracked files are dirty.\n\n## Why\n\nReview and CI need proof-grade source identity, not a moving target.\n\n## How\n\nUse MCP for live reasoning first, then return to a clean tree before bundling.\n\n## Links\n\n- [[Friday Night Monday Morning Provenance]] - shows the time-separated handoff case.\n- src/cli/commands/bundle.ts - dirty-state enforcement path.",
  tags=["workflow", "provenance", "safety"]
)
notes_update(
  id="20260419153000",
  body="The repository cognition layer depends on summary-first routing, explicit what/why/how structure, and review after mutation.\n\n## What\n\nThe notes graph is durable reasoning for humans and agents.\n\n## Why\n\nLow-signal notes degrade routing quality and CI trust.\n\n## How\n\nRequire summaries, keep notes atomic, and run governance checks after mutation.\n\n## Links\n\n- [[Safe Note Mutation Workflow]] - policy boundary and audit loop.\n- src/notes/validate.ts - governance enforcement.",
  tags=["notes", "quality", "workflow"]
)
```

## Step 4: Run Local Governance Review

Once the mutation is complete, review it through the CLI instead of trusting the edit implicitly:

```bash
cx notes check
cx notes graph --id 20260419153000 --depth 2
cx notes backlinks --id 20260419153000
```

Use the check to verify:

- every new or changed note still has a valid summary
- no note exceeded the size limits
- duplicate IDs did not enter the graph
- broken links or orphaned concepts did not appear

Trust remains explicit even in a trusted local mutation session:

- source tree: trusted
- notes: conditional
- agent output: untrusted until verified
- bundle: trusted

Why this protects you: note mutation is not finished when the write succeeds. It is finished when the updated cognition layer still passes governance and graph review.

## Step 5: Let CI Reconfirm The Gate

The same review path has a dedicated CI lane:

```bash
bun run ci:notes:governance
```

That lane runs `cx notes check` directly so cognition-layer quality stays visible as its own gate instead of being buried inside a larger test job.

Why this protects you: a note that looks acceptable in one local session still has to survive the same governance check the team and CI rely on later.
