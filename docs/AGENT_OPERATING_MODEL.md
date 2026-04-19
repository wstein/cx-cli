<!-- Source: AGENT_OPERATING_MODEL.md | Status: CANONICAL | Stability: STABLE -->

# Agent Operating Model

See: [MENTAL_MODEL.md](MENTAL_MODEL.md)
See: [OPERATING_MODES.md](OPERATING_MODES.md)

This document covers the integration layer for agent operators.

It does not redefine the canonical semantics of the CX triad, Track A vs Track B, MCP policy tiers, or artifact lifecycle. Those meanings live in [MENTAL_MODEL.md](MENTAL_MODEL.md). This document explains what those semantics become when an agent is connected to a repository over MCP.

## Integration-Layer Responsibilities

At the agent layer, the model becomes four practical questions:

1. Which tools are visible in this session?
2. Which capabilities are allowed, denied, or mutation-gated?
3. Which workflow should the operator invoke next?
4. Which audit trail explains what the agent actually did?

That is the scope of this document. Canonical semantics stay upstream in [MENTAL_MODEL.md](MENTAL_MODEL.md).

## Operator Decision Ladder

Use the integration layer in this order:

1. Start with [OPERATING_MODES.md](OPERATING_MODES.md) to pick the right surface.
2. Use `cx mcp` when the operator needs live agent help on the current checkout.
3. Use `cx doctor mcp` to confirm the resolved profile, workspace boundary, and policy state.
4. Let the agent operate inside the allowed capability set.
5. Promote work into Track A with `cx bundle` only when the job must become a reproducible artifact.

Why this protects you: the operator sees exactly when a live exploratory session stops being hypothesis work and starts becoming a proof path.

## Policy Consequences For Agents

The integration layer turns abstract policy into concrete tool visibility.

### `strict`

- Intended for CI and other untrusted automation
- Agent can read and observe
- Agent cannot plan or mutate

### `default`

- Intended for interactive operator sessions
- Agent can read, observe, and plan
- Agent cannot mutate notes or workspace files

### `unrestricted`

- Intended only for trusted local sessions
- Mutate-capability tools still require `enable_mutation = true`
- Without that explicit flag, the session is still non-mutating

## Capability Tiers

The MCP registration wrapper assigns every tool one capability tier. Policy enforcement, audit logging, and allow-or-deny decisions all use the same declaration.

- `read`: `list`, `grep`, `read`
- `observe`: `doctor_*`, `notes_read`, `notes_search`, `notes_list`, `notes_backlinks`, `notes_orphans`, `notes_code_links`, `notes_links`
- `plan`: `inspect`, `bundle`
- `mutate`: `notes_new`, `notes_update`, `notes_delete`, `notes_rename`, `replace_repomix_span`

See [STABILITY.md](STABILITY.md) for tool stability tiers and [MCP_TOOL_INTENT_TAXONOMY.md](MCP_TOOL_INTENT_TAXONOMY.md) for machine-oriented prompt grouping.

## Why Mutation Policy Denial Stops You

When an MCP session denies `notes_new`, `notes_update`, `notes_delete`, `notes_rename`, or `replace_repomix_span`, the denial is protecting the read/plan-versus-mutate boundary.

Why this stops you: an exploratory session should not silently cross from analysis into repository mutation. `cx` requires an explicit trust decision before mutate-capability tools appear, so operators can distinguish "the agent may inspect" from "the agent may edit."

## Audit Trail

When MCP audit logging is enabled (`[mcp.auditLogging]` in `cx.toml`), tool calls are recorded in `.cx/audit.log`:

```json
{
  "timestamp": "2025-04-17T14:30:00Z",
  "tool": "read",
  "policy_decision": "allowed",
  "capability": "read",
  "args": { "path": "src/main.ts" },
  "result_summary": "200 lines"
}
```

Audit logging is the integration-layer answer to "what did the agent really do?" It is also the bridge into future work on agent traceability.

## Integration Examples

### Interactive Local Session

```bash
cx mcp
cx doctor mcp --config cx.toml
```

The operator verifies the active policy before handing control to the agent.

### Trusted Local Note Mutation Session

```toml
[mcp]
policy = "unrestricted"
enable_mutation = true
```

Then review the result:

```bash
cx notes check
cx notes graph --id <note-id> --depth 2
```

See: [WORKFLOWS/safe-note-mutation.md](WORKFLOWS/safe-note-mutation.md)
See: [WORKFLOWS/agent-note-review-loop.md](WORKFLOWS/agent-note-review-loop.md)

## Links

- [MENTAL_MODEL.md](MENTAL_MODEL.md) — canonical semantics
- [OPERATING_MODES.md](OPERATING_MODES.md) — operator mode chooser
- [AGENT_INTEGRATION.md](AGENT_INTEGRATION.md) — IDE and client setup
- [WORKFLOWS/friday-to-monday.md](WORKFLOWS/friday-to-monday.md) — temporal provenance example
- [notes/Agent Operating Model](../notes/Agent%20Operating%20Model.md) — knowledge graph entry
