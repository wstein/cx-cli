---
id: 20260417165000
title: Config Merge Model
description: Explicit merge semantics for configuration inheritance, preventing silent overwrites and making conflicts visible
tags: [config, safety, merge, architecture]
---

# Config Merge Model

## Problem Statement

Configuration files often inherit from parent configs:
- Organization-level defaults → Project-specific overrides
- System-wide settings → User-local tweaks
- Pipeline defaults → Job-specific exceptions

Without explicit semantics, inheritance chains become opaque. Did an override replace a value on purpose or by accident? Were array values meant to be replaced or appended? These questions matter in CI/CD automation where silent changes can mask bugs.

## Solution

Every config merge operation enforces deterministic rules and returns a conflict list documenting what changed and why.

## Merge Rules

| Type | Rule | Behavior |
|------|------|----------|
| **Scalar** | Override wins | `{ base: 1, override: 2 }` → `2` (conflict recorded) |
| **Array** | Append-only | `{ base: [1,2], override: [3,4] }` → `[1,2,3,4]` (conflict recorded) |
| **Object** | Deep merge | Nested structures merged field-by-field recursively |
| **Undefined** | "Not set" | Missing in override = keep base value (no conflict) |
| **Null** | Valid value | Explicit null overwrites base (treated as scalar conflict) |

## Conflict Recording

Every merge returns conflicts documenting:
- **path**: Config key path (e.g., `files.exclude`, `dedup.mode`)
- **reason**: Why conflict occurred
- **baseValue**, **overrideValue**: The actual conflicting values

Example:
```typescript
{
  path: "files.exclude",
  reason: "array append behavior: both base and override are non-empty",
  baseValue: ["node_modules/**"],
  overrideValue: ["dist/**"]
}
```

## Why This Matters

Config changes affect reproducibility:
- Section definitions decide file grouping
- Include/exclude patterns determine the master file list
- Dedup rules affect overlap resolution

Making conflicts visible ensures config inheritance is:
- **Auditable**: Operators see what changed and why
- **Explicit**: No silent drops of array values or config fields
- **Safe**: Pattern mutations are detectable, not hidden

## References

- [mergeConfigs function](../src/config/merge.ts)
- [docs/config-reference.md](../docs/config-reference.md)
- [docs/SYSTEM_CONTRACTS.md](../docs/SYSTEM_CONTRACTS.md)
- [[Config Inheritance and Overlays]]
- [[Environment Variable Resolution]]
- [[Section Ownership and Overlaps]]
