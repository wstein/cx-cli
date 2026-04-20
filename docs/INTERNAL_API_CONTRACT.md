# Internal API Contract

This document records the internal interfaces that `cx` treats as stable
architecture seams before any plugin or extension system is introduced.

These interfaces are not public package APIs, but they are internal contract
surfaces. Changes to them should be deliberate, reviewed, and accompanied by
tests and documentation updates.

## RenderEngine

Defined in [src/render/types.ts](../src/render/types.ts).

`RenderEngine` owns proof-path section rendering.

Responsibilities:

- render section output for `xml`, `markdown`, `json`, and `plain`
- return output token counts
- return file content hashes
- return spans where the style requires them
- return structured plans and plan hashes when required

Rule:

- proof-path callers depend on `RenderEngine`, not on a concrete renderer

## StructuredRenderPlan

Defined in [src/render/types.ts](../src/render/types.ts).

`StructuredRenderPlan` is the kernel-owned proof model for rendered section
entries.

Responsibilities:

- stable entry ordering
- stable content identity
- stable per-entry token counts
- language tagging when available

Rule:

- verification logic depends on the structured plan contract, not on adapter
  output shapes

## TokenizerProvider

Defined in [src/shared/tokenizer.ts](../src/shared/tokenizer.ts).

`TokenizerProvider` owns deterministic token counting.

Responsibilities:

- count tokens for in-memory text
- count tokens for files on disk
- provide a stable seam between callers and tokenizer implementations

Current default implementation:

- [src/shared/tokens.ts](../src/shared/tokens.ts)

Rule:

- bundle planning, bundle reporting, and inspect reporting should depend on the
  provider interface instead of calling tokenizer implementations directly

## ScannerPipeline

Defined in [src/doctor/scanner.ts](../src/doctor/scanner.ts).

`ScannerPipeline` owns source-stage security scanning.

Responsibilities:

- scan source files before proof artifacts are finalized
- return structured findings with:
  - scanner id
  - profile
  - stage
  - severity
  - proof-blocking status
- enforce explicit fail/warn handling

Current default implementation:

- the reference scanner bridge around the installed oracle scanner

Rule:

- scanning behavior belongs to the pipeline contract, not to renderer helpers

## Stability Rules

- Add new internal interfaces only when they create a durable ownership
  boundary.
- Refactors that cross these seams must preserve contract tests and runtime
  behavior.
- Do not introduce plugin-facing variability into these interfaces until the
  plugin system itself is explicitly implemented.
