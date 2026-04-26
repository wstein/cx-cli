---
id: 20260415124000
aliases: ["Category A Invariants", "Hard Failures"]
tags: ["safety", "invariants"]
---
Category A invariants represent fundamental pipeline failures that are entirely non-configurable. Unlike Category B behaviors, no environment variable, CLI flag, or TOML key can bypass a Category A failure. Examples include section overlaps (when overlap failure mode is active), asset collisions, missing core adapter contracts, and unsafe dirty working trees without explicit `--force`. These hard boundaries exist because allowing them to be configured away would produce an ambiguous or unverifiable bundle.

The stop itself is the feature. Each hard failure protects a specific invariant:

- overlap failure protects one-file, one-owner section determinism
- unsafe dirty protects source provenance and later verification
- degraded extraction protects packed-content identity and coordinate trust

## Links
* [[Section Ownership and Overlaps]]
* src/config/types.ts - Category B behavioral settings remain configurable, but Category A invariants do not.
