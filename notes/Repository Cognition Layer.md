---
id: 20260419153000
aliases: ["Cognition Layer", "Notes Quality Gate"]
tags: ["notes", "architecture", "quality"]
---
The notes graph is the repository cognition layer: durable reasoning that agents and humans can query safely only if the graph keeps strong signal-to-noise, summary-first routing, and bounded note size.

For AI-generated notes, the quality question is not whether text was produced. The quality question is whether the note adds one reusable fact, decision, mechanism, or constraint that later workflows can trust without rereading the entire repository.

The governance model is practical:

- the first paragraph must summarize the note clearly enough for manifest routing
- the note should answer what, why, and how
- the note must stay small enough to remain atomic instead of becoming a prose dump

That is why summary requirements and size limits belong in validation and CI. Without those constraints, the cognition layer stops being a routing surface and turns into low-confidence context spam.

The next quality step is not just stricter validation. It is better signal measurement. Cognition scoring should eventually help CI distinguish "syntactically valid note" from "note that actually improved repository memory," while agent traceability should connect note mutations back to audit logs and review workflows.

## Links

- [[Manifest-Side Note Summaries]] - Manifest routing depends on strong summaries.
- [[Operational Bifurcation]] - Track B discovers reasoning, Track A proves it, and notes preserve it.
- [[Note Graph Audit]] - Graph review helps confirm that new notes improved the knowledge layer instead of just enlarging it.
