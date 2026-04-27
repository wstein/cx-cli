---
id: 20260427102000
title: Notes Lint Mutation Contract
aliases: ["notes lint write contract", "structural note mutation enum"]
tags: ["notes", "lint", "safety"]
---
`cx notes lint --write` is a structural mutation command, not a prose editor and not an MCP bypass.

Allowed mutation kinds are machine-checkable:

```ts
type NotesLintMutationKind =
  | "frontmatter.path_tags"
  | "frontmatter.structural_anchor";
```

The command must not edit note prose body content. Every write must preserve the body SHA-256, append a record to `notes/.lint-history.jsonl`, and remain outside the `cx bundle` import path.

`updated_at` is audit metadata, so stale timestamp findings are report-only. A human may update them as part of the note edit that actually refreshed the content.

Future mutation kinds must extend the enum first, then add tests proving body-byte preservation and audit-log output. Section config edits remain proposal-only unless a separate explicit command owns that write path.

## Links

- [[Notes Gating Policy]]
- [[Safe Note Mutation Workflow Contract]]
- [[CX Semantic Drift Detection]]
