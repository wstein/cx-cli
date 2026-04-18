---
id: 20260415171500
aliases: ["Read/Write Taxonomy", "Agent Intent Tool Policy"]
tags: ["mcp", "agent", "documentation"]
---
The native `cx mcp` tool set can be grouped by agent intent instead of implementation origin. This machine-oriented taxonomy is useful for prompt engineering, policy enforcement, and safe agent session design.

Capability declarations now live beside the MCP tool registration metadata in
source, and policy evaluation derives from that shared catalog. There is no
separately maintained capability map to keep in sync.

## Read / Observe
Safe inspection and context gathering tools. They do not mutate state.

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
Deterministic plan generation and bundle metadata preview tools. These do not mutate workspace files.

- `inspect`
- `bundle`

## Write / Mutate
State-changing tools. Expose them only when the agent is explicitly authorized to modify content.

- `replace_repomix_span`
- `notes_new`
- `notes_update`
- `notes_rename`
- `notes_delete`

## Policy Guidance

1. Default to Read / Observe mode for every session.
2. Require explicit permission before enabling Write / Mutate tools.
3. Gather context first, then mutate second.
4. Avoid bulk mutations in a single turn unless the task is precise and reviewed.

This taxonomy is intentionally separate from the human-facing 3-pillar origin taxonomy. Human docs teach subsystem boundaries; this note teaches deterministic tool intent.

## Links
* [[Operational Bifurcation]]
* [[Agentic Ecosystem MCP]]
* [[MCP Transport Protocol]]
