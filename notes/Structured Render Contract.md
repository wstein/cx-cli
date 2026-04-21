---
id: 20260417165100
title: Structured Render Contract
tags: [architecture, phase-1, determinism, cryptography]
target: current
---
# Structured Render Contract

## Problem Statement

The original render span computation relied on **heuristic parsing of rendered output**:
- Markers (XML tags, Markdown headings, plain-text delimiters) were parsed post-render
- Span calculations were indirect inference, not direct observation
- No cryptographic verification of render plan integrity

## Solution: Structured Truth at Render Time

**Phase 1 establishes structured render as the single source of truth.**

The repomix adapter's `packStructured()` function returns:

```ts
interface StructuredRenderEntry {
  path: string
  content: string
  sha256: string          // Computed during extraction, not after render
  tokenCount: number
}

interface StructuredRenderPlan {
  entries: StructuredRenderEntry[]
  ordering: string[]      // Canonical lexicographic sort
}
```

## Key Invariants

1. **Deterministic Ordering**: All entries are sorted lexicographically by path
   - Invariant enforced by `validatePlanOrdering(plan): boolean`
   - Detects regressions or variations in file order
   
2. **Content Hash Integrity**: Each entry's sha256 is immutable
   - Computed during structured extraction
   - Verified by `validateEntryHashes(entries): Map<string, string>`
   - Detects any drift in normalized content
   
3. **Plan Hash (Cryptographic Proof)**: `renderPlanHash = sha256(JSON.stringify(plan))`
   - Stored in manifest for reproducibility
   - Computed by `computePlanHash(plan): string`
   - Verifies the entire render contract is sound

## Downstream Effects

### Manifest (src/manifest/types.ts)
- Added `renderPlanHash?: string` field
- Captures aggregate hash of all section plans
- Optional (for backwards compatibility with pre-structured renders)

### Verification (src/bundle/verify.ts)
- New failure types:
  - `structured_contract_mismatch`: Entry hash validation failed
  - `ordering_violation`: Ordering is not lexicographically sorted
  - `render_plan_drift`: Plan changed between renders
  
- `verifyBundleAgainstSourceTree()` now validates:
  1. Plan ordering is deterministic
  2. All entry hashes are consistent
  3. Source tree render is reproducible

### API (src/adapter/oracleRender.ts)
- `RenderSectionResult` now includes:
  - `structuredPlan?: StructuredRenderPlan`
  - `planHash?: string`

## Benefits

| Aspect | Before | After |
|--------|--------|-------|
| **Span Computation** | Heuristic parsing of markers | Deterministic extraction during render |
| **Content Verification** | Indirect (source tree re-render) | Direct (structured hashes) |
| **Reproducibility** | Dependent on render variation tolerance | Cryptographically guaranteed |
| **Failure Detection** | Silent regressions possible | Explicit failure classes |

## Testing

- `tests/unit/structuredRender.test.ts`: Comprehensive test suite covering:
  - Ordering validation (sorted, unsorted, edge cases)
  - Hash consistency checks
  - Plan hash determinism
  - Conversion to backwards-compatible maps

## References

- [docs/modules/architecture/pages/implementation-reference.adoc](../docs/modules/architecture/pages/implementation-reference.adoc)
- [docs/modules/architecture/pages/system-contracts.adoc](../docs/modules/architecture/pages/system-contracts.adoc)
- [src/render/structuredPlan.ts](../src/render/structuredPlan.ts)
- [[src/bundle/verify.ts]]
