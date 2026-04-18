---
id: 20260415123500
aliases: ["Repomix Adapter"]
tags: ["architecture", "adapter"]
---
`cx` strictly isolates its rendering backend using the Repomix Adapter Boundary. The system does not shell out to Repomix via the OS; instead, it uses a narrow in-process module boundary to maintain synchronous, deterministic control over rendering. This separation of concerns ensures that the `cx` planner and manifest builder never need to parse adapter internals, relying exclusively on capabilities like `packStructured` for exact span captures while isolating the rendering engine from the planner logic.

This boundary is intentionally preserved during the current reliability wave.
The project is not replacing the Repomix fork or moving to a different render
framework right now; the active work is to tighten command and test boundaries
around it so adapter behavior stays explicit while shared process state keeps
shrinking elsewhere in the stack.

## Links
* [[Deterministic Context Bundling]]
* [[Parallel Rendering Invariants]]
