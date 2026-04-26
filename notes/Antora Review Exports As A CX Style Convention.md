---
id: 20260422151002
aliases: ["cx style docs review exports", "docs export convention"]
tags: [docs, antora, convention, style]
---
Antora-derived review exports could become a strong `cx` style convention across projects once the `v0.5` docs export workflow proves stable and useful in practice.

## What

Treat per-surface docs review exports as a likely future `cx` convention for
projects that adopt Antora as their canonical documentation system.

The convention would mean a `cx`-shaped project does not only keep curated
docs in Antora source form, but also emits reviewable final-doc projections
that humans and LLMs can inspect directly.

## Why

This pattern matches the broader `cx` operating model: keep canonical source
ownership clear, preserve trust boundaries, and still produce downstream
artifacts that are easier for review and handoff workflows to consume.

If the export proves lightweight, deterministic, and genuinely useful across
multiple repositories, it becomes more than one feature request. It becomes a
recognizable part of what `cx style` means for docs-aware projects.

## How

Do not declare the convention early.

First ship and evaluate:

- the `v0.5` `cx docs export` workflow
- per-surface `.mmd` review outputs plus bundled `.mmd.txt` artifacts
- explicit trust language for derived review exports
- operator feedback on whether the exports improve review and LLM handoff

If those results hold across more than one project, promote the pattern in
templates, docs, and project guidance as a `cx` style convention.

## Links

- [[Antora Custom Markdown Exporter]]
- [[Antora MultiMarkdown Exports Stay Outside Proof Artifacts]]
- [[v0.5 Docs Export Workflow]]
- [[Documentation Surface Split for Antora]]
