# MCP Tool Intent Taxonomy

This document is machine-oriented. It is intended for prompt engineering and agent policy guidance, not for primary human documentation.

`cx mcp` exposes tools in three intent-focused groups:

- `Read / Observe` tools: safe inspection, search, and non-mutating note reads.
- `Plan / Preview` tools: deterministic planning and bundle metadata previews.
- `Write / Mutate` tools: state changes, edits, and new note or bundle actions.

Use this taxonomy when building system prompts, tool selectors, or agent policies to enforce deterministic behavior and reduce accidental state changes.

## Read / Observe Tools

These tools should be exposed to agents when the task is exploratory, investigative, or review-only. They do not change workspace files, notes, or bundle state.

- `list`
- `grep`
- `read`
- `doctor_mcp`
- `doctor_workflow`
- `doctor_overlaps`
- `doctor_secrets`
- `notes_read`
- `notes_search`
- `notes_list`
- `notes_backlinks`
- `notes_orphans`
- `notes_code_links`
- `notes_links`

## Plan / Preview

These tools produce deterministic plans or bundle metadata without mutating the workspace.

- `inspect`
- `bundle`

### Plan/Preview Usage Guidance

- Use these tools after gathering enough context from Read / Observe tools.
- Treat plan outputs as review artifacts; apply mutations through explicit Write / Mutate tools only.
- In strict MCP policy mode, these tools are denied by design.

### Read/Observe Usage Guidance

- Use these tools to understand the repository, verify state, and gather evidence.
- Never use them to make or apply changes.
- If the agent is asked to recommend a fix or document a problem, keep the output descriptive and defer mutation to the Write / Mutate group.

## Write / Mutate Tools

These tools change repository state, notes, or bundle planning metadata. Expose them only when the agent is explicitly authorized to modify content.

- `replace_repomix_span`
- `notes_new`
- `notes_update`
- `notes_rename`
- `notes_delete`

### Write/Mutate Usage Guidance

- Require explicit user authorization or a strong policy before enabling these tools.
- Use the Read / Observe group first to gather context and confirm the target location.
- Avoid requesting multiple mutations in a single turn unless the task is clearly defined.

## Example Prompt Pattern

Use this format when constructing a system prompt for an agent that consumes the MCP tool set:

```text
You have access to two tool categories:

1. Read / Observe tools for safe inspection and context gathering.
2. Plan / Preview tools for deterministic planning and bundle metadata.
3. Write / Mutate tools for explicit, authorized changes.

Start by using Read / Observe tools to locate the relevant file, section, or note. Use Plan / Preview tools to confirm deterministic outputs, then request Write / Mutate tools only with high confidence in the exact target.
```

## Recommended Policy

- Default to Read / Observe mode for all sessions.
- Require an explicit permission token or user affirmation before enabling Write / Mutate.
- Prefer `notes_new`, `notes_update`, and `replace_repomix_span` only after a successful `read` or `inspect` operation.

## Why This Doc Exists

The human-facing `docs/AGENT_INTEGRATION.md` uses the origin-based three-pillar taxonomy for readability and subsystem teaching. This separate machine-oriented doc exists to translate that human structure into a strict intent-based policy layer that agents can use reliably.
