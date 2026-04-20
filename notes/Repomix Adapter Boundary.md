---
id: 20260415123500
aliases: ["Repomix Adapter"]
tags: ["architecture", "adapter"]
target: current
---
`cx` strictly isolates its rendering backend using the Repomix Adapter Boundary. The system does not shell out to Repomix via the OS; instead, it uses a narrow in-process module boundary to maintain synchronous, deterministic control over rendering. This separation of concerns ensures that the `cx` planner and manifest builder never need to parse adapter internals, relying exclusively on capabilities like `packStructured` for exact span captures while isolating the rendering engine from the planner logic.

The boundary now exists only as a parity-oracle seam.

- native rendering owns the production proof path
- the adapter boundary remains for reference-oracle tests and diagnostics
- compatibility is preserved through contract tests, not by shipping a runtime
  adapter dependency

## Links
* [[Structured Render Contract]]
* [[Adapter Oracle And Reference Roles]]
* [[Parallel Rendering Invariants]]
