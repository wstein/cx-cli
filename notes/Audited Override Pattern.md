---
id: 20260427101000
title: Audited Override Pattern
aliases: ["audited override", "recorded override"]
tags: ["safety", "vcs", "manifest"]
---
An audited override lets an operator proceed while preserving evidence that a safety gate was bypassed.

For dirty state, `--force` records `forced_dirty` and `--ci` records `ci_dirty` in the manifest. The override does not make the tree clean; it makes the provenance explicit enough for downstream review and rejection rules.

The pattern has three requirements:

- the command must name the override explicitly
- the artifact must record the resulting state
- remediation must explain the safer default path before describing the override

This keeps local exploration and CI edge cases possible without weakening the proof contract for ordinary bundles.

## Links

- [[Dirty State Taxonomy]]
- [[System Trust Contract]]
- [[Bundle Verify Extract Workflow Contract]]
