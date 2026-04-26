---
id: 20260422150635
aliases: ["docs export trust boundary", "antora export bundle boundary"]
tags: [docs, antora, bundle, trust, v0-5]
---
Antora-derived `.mmd` review exports and bundled `.mmd.txt` derivatives should stay outside the default proof-path bundle contract in `v0.5`, even when they are generated beside bundle outputs for review.

## What

Treat Antora MultiMarkdown exports as derived review outputs.

They may be generated from the curated docs surface and written alongside
bundle outputs, but they should not automatically become ordinary bundle
sections, manifest-trusted proof records, or verifier-owned truth.

## Why

The current bundle contract proves native section outputs, the shared
handover, copied assets, manifest data, and checksum coverage.

Antora export is a different class of output: it depends on the curated docs
toolchain, preserves reader-oriented document boundaries, and solves a review
and LLM-consumption problem rather than a proof-path packing problem.

Keeping that distinction explicit prevents trust inflation, misleading
"first-class artifact" language, and accidental coupling of docs build
failures to the core bundle path before the contract work exists.

## How

In `v0.5`, prefer:

- `cx docs export` for explicit Antora-derived review exports
- optional bundle-adjacent placement only when the operator requests it
- explicit metadata such as source surface, export path, generator, and hash
- wording such as derived review export instead of proof artifact

Only promote these exports into the proof contract after manifest schema,
checksums, validation, verification, pruning, and docs all agree on the new
semantics.

## Links

- [[Antora Custom Markdown Exporter]]
- [[Antora and AsciiDoctor Adoption Boundary]]
- [[Output Extension Model]]
- [[System Trust Contract]]
- [src/cli/commands/bundle.ts](/Users/werner/github.com/wstein/cx-cli/src/cli/commands/bundle.ts)
