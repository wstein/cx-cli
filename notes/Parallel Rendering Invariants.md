---
id: 20260413153645
aliases: ["parallel-rendering", "performance"]
tags: ["rendering", "determinism", "architecture"]
status: current
---
# Parallel Rendering Invariants

Parallel rendering improves continuous integration throughput without changing
deterministic output.

Rendering repository sections sequentially is a bottleneck for large codebases.
`cx` processes independent section renderings concurrently through the renderer
while keeping final artifact ordering deterministic. Section outputs, manifest
records, and checksum sidecars are always assembled and written in a stable,
reproducible order regardless of which rendering thread completes first.

## Links

- [[Deterministic Hashing Strategy]] - Deterministic output is paired with stable artifact hashes and ordering.
- [[VCS Master Base]] - The settled plan dictates the final deterministic order,
  untouched by rendering concurrency.
