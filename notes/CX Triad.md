---
id: 20260415123000
aliases: ["CX Triad", "Operational Bundling Triad"]
tags: ["architecture", "philosophy"]
---
The CX architecture is built upon a triad specifically designed for operational bundling rather than just exploratory context generation. The triad consists of:

1. Immutable Snapshots: Static, verifiable artifacts created via `cx bundle` that provide bit-for-bit identity and token accounting.
2. Live Agent Protocol: Real-time workspace interaction via the `cx mcp` stdio transport layer, enforcing the same strict boundary rules for active agents.
3. Durable Knowledge: A machine-queryable knowledge graph maintained via `cx notes`, storing metadata directly in the manifest to avoid expensive file scans.

## Links
* [[Operational vs Exploratory]]
* [[Manifest-Centric Metadata]]
