---
id: 20260420143000
aliases: ["antora markdown exporter", "export antora to markdown files"]
tags: [docs, antora, exporter, markdown]
target: v0.5
---

Antora-derived MultiMarkdown export belongs in the `v0.5` line as a derived review workflow, not as an automatic proof-path bundle artifact.

## What

Add a docs export path that emits separate `.mmd` files for canonical
surfaces such as architecture, manual, onboarding, workflows, and release.

Use a staged rollout:

- `v0.5`: support `cx bundle --include-doc-exports` as an opt-in bridge
- `v0.6`: consider making doc exports default bundle content

Prefer an explicit command such as `cx docs export` over making Antora export
part of the default `cx bundle` path.

If bundle-side placement is added later, treat the exported files as derived
review exports first, with explicit provenance and trust labeling, rather than
as ordinary section outputs.

## Why

The user problem is valid: LLMs and reviewers should be able to inspect final
docs content directly instead of reconstructing it from `.adoc` sources and
Antora assumptions.

But `cx bundle` is a proof-path artifact surface, while Antora export is a
curated docs projection. Folding the export into bundle truth too early would
blur trust boundaries, add heavier runtime dependencies to bundling, and imply
validation semantics the current manifest and verifier do not provide.

## How

Implement the export in `v0.5` with these constraints:

- add `cx docs export` as the primary operator entrypoint
- emit per-surface `.mmd` files instead of one flattened mega-document
- preserve Antora topic boundaries and provenance metadata
- support `cx bundle --include-doc-exports` as an opt-in-only bridge into the
  bundle folder, writing `.mmd.txt` bundle artifacts by default
- allow optional placement alongside bundle outputs only when explicitly
  requested
- if recorded in the manifest, use a non-proof field such as derived review
  exports instead of reusing proof-path section semantics

Do not call these files canonical docs or verified bundle truth until the
manifest, checksum, validate, and verify contracts are deliberately extended.

## Links

- [[Antora and AsciiDoctor Adoption Boundary]]
- [[Antora MultiMarkdown Exports Stay Outside Proof Artifacts]]
- [[v0.5 Bundle Includes Doc Exports Only By Opt-In]]
- [[v0.6 Bundle Includes Doc Exports By Default]]
- [[Output Extension Model]]
- [[Publish Antora Docs to GitHub Pages]]
- `docs/modules/ROOT/pages/`
- https://docs.antora.org/assembler/latest/html-single-extension/
- https://docs.antora.org/assembler/latest/custom-exporter-extension/
