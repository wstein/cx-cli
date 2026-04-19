---
id: 20260419111000
aliases: ["Friday to Monday Provenance", "Temporal provenance scenario"]
tags: ["workflow", "provenance", "operations"]
target: current
---
Provenance becomes convincing when shown across time instead of as a static label.

The practical scenario is:

1. Friday night: a developer has dirty tracked changes and needs fast live AI help, so the correct mode is `cx mcp`.
2. Friday night: a local `--force` bundle may still exist for temporary review, but it must remain visibly `forced_dirty` rather than being treated as a promotable artifact.
3. Monday morning: CI should trust only the clean bundle path built from committed source state.

This is why `forced_dirty`, checksums, and verification labels exist. They are not abstract metadata. They tell later systems whether the artifact in hand is a local convenience snapshot or a clean handoff candidate.

## Links
* [[Operational Bifurcation]]
* [[Category A Hard Failures]]
* [[Choose Your Operating Mode]]
