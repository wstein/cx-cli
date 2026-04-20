# Render Kernel Contract

This document freezes the current proof-path rendering behavior that the native
kernel must preserve while `cx` replaces the Repomix-backed engine underneath.
It is a contract document, not a design sketch.

The contract is derived from the currently implemented proof path in:

- [`src/render/engine.ts`](../src/render/engine.ts)
- [`src/render/ordering.ts`](../src/render/ordering.ts)
- [`src/render/planHash.ts`](../src/render/planHash.ts)
- [`src/render/spans.ts`](../src/render/spans.ts)
- [`src/adapter/oracleRender.ts`](../src/adapter/oracleRender.ts)
- [`src/render/structuredPlan.ts`](../src/render/structuredPlan.ts)
- [`src/bundle/verify.ts`](../src/bundle/verify.ts)
- [`src/extract/parsers.ts`](../src/extract/parsers.ts)

And it is already enforced by tests such as:

- [`tests/bundle/bundle.render-spans.contract.test.ts`](../tests/bundle/bundle.render-spans.contract.test.ts)
- [`tests/bundle/parsers.test.ts`](../tests/bundle/parsers.test.ts)
- [`tests/unit/structuredRender.test.ts`](../tests/unit/structuredRender.test.ts)
- [`tests/contracts/structuredRender.contract.test.ts`](../tests/contracts/structuredRender.contract.test.ts)

The adapter/oracle seam remains comparison-only:

- useful for parity diagnostics
- useful for oracle capability inspection
- useful for migration/reference testing
- not required for ordinary proof-path execution

## 1. Output Contract

The proof path currently supports four styles: `xml`, `markdown`, `json`, and
`plain`.

### XML

Observed contract:

- file wrappers use `<file path="...">`
- content begins immediately after the opening wrapper, with one wrapper-owned
  newline removed from the content start offset
- empty files remain representable
- multi-file sections preserve deterministic file ordering inside the wrapper
- content may contain literal text such as `</file>` and extraction must still
  recover normalized packed content correctly

Evidence:

- [`src/adapter/oracleRender.ts`](../src/adapter/oracleRender.ts)
- [`tests/bundle/parsers.test.ts`](../tests/bundle/parsers.test.ts)

### Markdown

Observed contract:

- each file begins with `## File: <path>`
- content is wrapped in fenced blocks
- packed-content expectation strips a trailing newline before comparison
- multi-file sections preserve deterministic file ordering

Evidence:

- [`src/extract/parsers.ts`](../src/extract/parsers.ts)
- [`tests/bundle/parsers.test.ts`](../tests/bundle/parsers.test.ts)

### JSON

Observed contract:

- output is an object keyed by file path
- packed-content expectation strips a trailing newline before comparison
- JSON sections do not participate in output-span capture

Evidence:

- [`src/extract/parsers.ts`](../src/extract/parsers.ts)
- [`tests/bundle/parsers.test.ts`](../tests/bundle/parsers.test.ts)
- [`tests/bundle/bundle.render-spans.contract.test.ts`](../tests/bundle/bundle.render-spans.contract.test.ts)

### Plain

Observed contract:

- file markers use repeated `=` separators with `File: <path>`
- extraction compensates for wrapper and trailing-padding quirks
- multi-file sections preserve deterministic file ordering
- packed-content comparison relies on the current separator and padding model

Evidence:

- [`src/extract/parsers.ts`](../src/extract/parsers.ts)
- [`tests/bundle/parsers.test.ts`](../tests/bundle/parsers.test.ts)

## 2. Ordering Contract

The render contract requires deterministic ordering at three levels:

- file selection passed into the renderer must already be stable
- structured render entries are sorted lexicographically by path
- plan ordering validation fails if the resulting order is not deterministic

This behavior is currently enforced through:

- [`extractStructuredPlan`](../src/render/structuredPlan.ts)
- [`validatePlanOrdering`](../src/render/ordering.ts)
- [`src/bundle/verify.ts`](../src/bundle/verify.ts)

The native kernel must preserve the same stable per-entry ordering and the same
ordering expectations for structured plans.

## 3. Normalization Contract

Verification and extraction compare normalized packed content, not only raw file
bytes.

Current normalization assumptions include:

- XML packed-content comparison compensates for wrapper-owned newline placement
- Markdown packed-content comparison strips a trailing newline before matching
- JSON packed-content comparison strips a trailing newline before matching
- Plain packed-content comparison compensates for wrapper separators and trailing
  padding

The native kernel must preserve the exact content that is hashed for:

- per-file packed-content hashes
- structured render entry hashes
- verification against source-tree re-rendering

Evidence:

- [`src/extract/parsers.ts`](../src/extract/parsers.ts)
- [`src/extract/resolution.ts`](../src/extract/resolution.ts)
- [`tests/bundle/parsers.test.ts`](../tests/bundle/parsers.test.ts)

## 4. Span Contract

Span semantics are already frozen by integration tests.

Current contract:

- `xml`, `markdown`, and `plain` must emit absolute `outputStartLine` and
  `outputEndLine`
- `json` must emit `null` spans
- span values are absolute line coordinates within the rendered section output
- content start offsets depend on style-specific wrapper structure

Evidence:

- [`findContentStartOffset`](../src/render/spans.ts)
- [`tests/bundle/bundle.render-spans.contract.test.ts`](../tests/bundle/bundle.render-spans.contract.test.ts)

## 5. Aggregate Plan Hash Contract

The aggregate render-plan hash is part of verification, not implementation
detail.

Current behavior:

- each structured section yields a per-section `planHash`
- verification collects `[sectionName, planHash]` tuples
- tuples are sorted by section name
- the sorted tuples are serialized with `JSON.stringify`
- the aggregate hash is computed with normalized SHA-256 text hashing
- verification fails when the recomputed aggregate plan hash drifts

Evidence:

- [`computePlanHash`](../src/render/planHash.ts)
- [`computeAggregatePlanHash`](../src/render/planHash.ts)
- [`src/bundle/verify.ts`](../src/bundle/verify.ts)

## Acceptance Checklist

- Every proof-path behavior is written down once here
- Each contract section points to code and tests as evidence
- No aspirational native-kernel behavior is mixed into the current contract

## Parity Enforcement

`cx` now carries a dedicated parity lane:

- `bun run ci:test:render-parity`

That lane compares the kernel-facing default render engine against the explicit
Repomix oracle for:

- output text
- output spans
- structured plans
- per-entry hashes
- section plan hashes
- aggregate plan hashes

The parity lane is release-gating CI evidence. It proves migration correctness
without turning the adapter into permanent architecture.

Plain and JSON also carry a dedicated native render contract lane for
style-specific edge cases that are easier to read as direct contract assertions
than as parity fixtures alone.

## Current Contract State

The default proof path is now split deliberately:

- all four proof styles (`xml`, `markdown`, `plain`, and `json`) now flow
  through the native kernel implementation in
  [`src/render/native/`](../src/render/native/)
- structured render plans for the native proof path are now built directly from
  source files by the kernel
- the shared handover is already kernel-rendered
- the Repomix-backed renderer remains the parity oracle seam, not the default
  proof-path implementation and not a hidden runtime fallback

This remains one contract. The current state changes implementation beneath the
seam, not the observable proof-path behavior frozen above.
