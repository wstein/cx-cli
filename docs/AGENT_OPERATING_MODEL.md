<!-- Source: AGENT_OPERATING_MODEL.md | Status: CANONICAL | Stability: STABLE -->

# Agent Operating Model

See: [OPERATING_MODES.md](OPERATING_MODES.md)
See: [MENTAL_MODEL.md](MENTAL_MODEL.md)

cx-cli provides three distinct agent-facing surfaces for repository context. This document narrows the canonical mental model down to policy and workflow consequences for agent operators.

## Three-Workflow Model

### 1. Bundle (CI/CD, Immutable)

**Command:** `cx bundle`

**Semantics:** Generate an immutable snapshot of the workspace. Output is written to `dist/` and committed to version control.

**Guarantees:**
- Reproducible: exact same source → exact same bundle output
- Tamper-evident: bundles are read-only after creation
- Auditable: all bundles are in git history

**Use cases:**
- Pre-compute context for downstream CI/CD pipelines
- Offline AI training (agent doesn't need live file access)
- Compliance & audit trail (immutable records)
- Performance optimization (no runtime analysis needed)

**Policy:** Bundles enforce strict security model by design; they're static files with no execution capability.

### 2. MCP (Interactive, Live)

**Command:** `cx mcp`

**Semantics:** Start an MCP server that exposes live workspace tools. Agent can read files, search, inspect bundle plans, manage notes, and observe diagnostics in real time.

**Guarantees:**
- Live: tools operate on current workspace state
- Deterministic: same inputs → same outputs (no external randomness)
- Audited: optionally logs all tool calls to `.cx/audit.log`

**Use cases:**
- Interactive development (agent writes code, explores incrementally)
- Dynamic bundling (agent decides what context is needed, refines it)
- Live analysis and troubleshooting
- Multi-turn agentic workflows with feedback loops

**Policy:** MCP is policy-driven; access controlled by `[mcp.policy]` in `cx.toml`. Three preset policies:
- **strict** (CI/CD): read + observe only (no writes, no planning)
- **default** (interactive): read + observe + plan (no mutations; agent can't modify notes or code)
- **unrestricted** (local dev): full mutate capability is available only when `enable_mutation = true`

### 3. Notes (Durable Knowledge)

**Command:** `cx notes`

**Semantics:** Maintain a knowledge graph of atomic, interlinked notes in `notes/` directory. Notes are versioned in git and support queries, consistency checks, and coverage analysis.

**Guarantees:**
- Persistent: notes survive restarts and are committed to git
- Structured: mandatory frontmatter with id, title, tags, aliases
- Queryable: full-text search, graph queries, code references

**Use cases:**
- Document architectural decisions
- Track design rationale and context
- Build institutional knowledge
- Link code to design (backlinks to source)
- Audit knowledge coverage and gaps

**Policy:** `cx notes` on the CLI is a direct local operator command. Over MCP, note reads are observe capability and note writes are mutate capability. In practice that means note mutation is denied in default and strict policy modes, and is only exposed intentionally in trusted local sessions.

---

## Decision Matrix

| Task | Workflow | Why |
|------|----------|-----|
| Pre-compute context for CI/CD | Bundle | Reproducible, auditable, no runtime overhead |
| Agent writes code interactively | MCP | Live feedback, incremental refinement, policy-controlled |
| Agent reads and updates notes | Notes | Persistent knowledge, structured, queryable |
| Agent needs to know *if* bundles can be created | MCP + inspect | `cx inspect` shows bundle plan without writing |
| Agent needs full workspace analysis for decisions | MCP + grep/read | Live tools with zero lag |
| Audit what agent tools were called | MCP | Enable `[mcp.auditLogging]` in cx.toml |

---

## Policy Tier Mapping

**CI/CD Environment** → `policy: strict`
- Agent can: read files, grep, inspect bundle plan, observe diagnostics
- Agent cannot: write code, create/modify notes, mutate workspace
- Rationale: Untrusted automation; changes must be human-reviewed

**Interactive Development** → `policy: default`
- Agent can: read, observe, plan (cx inspect, cx notes read)
- Agent cannot: write code, create/modify notes
- Rationale: Agent helps explore and plan, but humans make final calls

**Local Development** → `policy: unrestricted`
- Agent can: everything only when `enable_mutation = true`; otherwise mutate tools remain locked
- Rationale: Trusted local environment, full autonomy

## Why Mutation Policy Denial Stops You

When an MCP session denies `notes_new`, `notes_update`, `notes_delete`, `notes_rename`, or `replace_repomix_span`, the denial is protecting the read/plan-versus-mutate boundary.

Why this stops you: an exploratory session should not silently cross from analysis into repository mutation. `cx` requires an explicit trust decision before mutate-capability tools appear, so operators can distinguish "the agent may inspect" from "the agent may edit."

---

## Audit Trail

When MCP audit logging is enabled (`[mcp.auditLogging]` in `cx.toml`), all tool calls are logged to `.cx/audit.log`:

```json
{
  "timestamp": "2025-04-17T14:30:00Z",
  "tool": "read",
  "policy_decision": "allowed",
  "capability": "read",
  "args": {"path": "src/main.ts"},
  "result_summary": "200 lines"
}
```

Operators can review logs to understand what agents accessed and modified.

---

## Tool Capability Tiers

All 22 tools are classified by capability. The MCP registration wrapper carries that capability into policy enforcement directly, so the same declaration controls registration, audit logging, and allow/deny decisions:

- **read**: list, grep, read (file access)
- **observe**: doctor_*, notes_read, notes_search, notes_list, notes_backlinks, notes_orphans, notes_code_links, notes_links (inspection)
- **plan**: inspect, bundle (analysis, no mutations)
- **mutate**: notes_new, notes_update, notes_delete, notes_rename, replace_repomix_span (writes)

See [STABILITY.md](STABILITY.md) for tool tier assignments (STABLE vs BETA).

---

## Example Workflows

### Scenario 1: CI/CD Pre-compute

```bash
# In GitHub Actions (policy: strict)
$ cx inspect --json > context-plan.json  # See what will be bundled
$ cx bundle                              # Generate immutable snapshot
$ git commit -am "docs: update context bundle"
```

Agent cannot see the --json output or run write operations.

### Scenario 2: Interactive Development

```bash
# Local (policy: default)
$ cx mcp &                               # Start MCP server
$ # Agent now has access to:
# - read (files)
# - grep (search)
# - inspect (bundle planning)
# - doctor_* (diagnostics)
# - notes_read/search (knowledge base)
# - notes_new/update (create/edit notes)
$ # Agent cannot:
$ # - Write code (read-only)
$ # - Run `cx bundle` (needs plan capability approval)
```

### Scenario 3: Safe Note Mutation In A Trusted Local Session

```bash
# Trusted local machine
$ cx mcp &
# Default MCP policy still denies note mutation.
# Enable it intentionally in cx-mcp.toml or cx.toml:
#
# [mcp]
# policy = "unrestricted"
# enable_mutation = true
#
# Then verify the active profile:
$ cx doctor mcp --config cx.toml
$ cx notes links
$ cx notes graph --id <note-id> --depth 2
```

The session becomes mutation-authorized only after that explicit operator choice. Review the resulting note graph after the edit instead of treating note mutation as self-validating.

---

## Links

- [STABILITY.md](STABILITY.md) — Tool stability contracts and versioning
- [AGENT_INTEGRATION.md](AGENT_INTEGRATION.md) — IDE and client integration guide
- [MCP_TOOL_INTENT_TAXONOMY.md](MCP_TOOL_INTENT_TAXONOMY.md) — Tool categorization and intent
- [notes/Agent Operating Model](../notes/Agent%20Operating%20Model.md) — Knowledge graph entry
