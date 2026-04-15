---
id: 20260415124000
aliases: ["Category A Invariants", "Hard Failures"]
tags: ["safety", "invariants"]
---
Category A invariants represent fundamental pipeline failures that are entirely non-configurable. Unlike Category B behaviors, no environment variable, CLI flag, or TOML key can bypass a Category A failure. Examples include section overlaps (when overlap failure mode is active), asset collisions, missing core adapter contracts, and unsafe dirty working trees without explicit `--force`. These hard boundaries exist because allowing them to be configured away would produce an ambiguous or unverifiable bundle.

## Links
* [[Category B: Configurable Behaviors]]
* [[Section Ownership and Overlaps]]
