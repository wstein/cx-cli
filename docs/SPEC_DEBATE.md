# CX Documentation Debate

This note records the internal disagreement that led to the current
documentation shape. The full consensus lives in [spec-draft.md](./spec-draft.md).

## The Debate

### Dr. Arthur Pendelton

Arthur argued that the organic Zettelkasten model should remain the conceptual
center. He rated the idea of preserving manual association at `9/10` and
warned that over-optimization can turn a thinking system into a compliance
system.

### Elena Rostova

Elena argued that deterministic validation is the only reason the bundle can be
trusted at scale. She rated strict overlap handling and checksum enforcement at
`10/10` and emphasized that reliable storage protects later creativity.

### Julian Vance

Julian focused on reader flow. He rated structural signposting at `10/10` and
argued that the document must explain the transition from philosophy to code
instead of assuming the reader will infer it.

### Maya Lin

Maya proposed a layered document model with a clear main path and secondary
reference material. She rated that approach at `9/10` and argued that the
reader should never have to guess which layer they are in.

### Marcus Chen

Marcus asked for a distinction between meaning integrity and file integrity.
He rated that clarification at `8/10` and argued that the prose should say
when validation protects understanding and when it only protects storage.

### Chloe Bennett

Chloe argued that the strongest framing is an AI workflow bridge. She rated
that framing at `10/10` and said the document should explain why the
Zettelkasten material matters to downstream agents.

### Rachel Brooks

Rachel pushed for a decision instead of an endless debate. She rated the need
for a primary audience at `10/10` and insisted that the final structure be easy
to execute.

### Samir Patel

Samir wanted the structure to be testable from a reader-comprehension
perspective. He rated explicit section takeaways at `9/10` and asked for a
document that answers its own basic questions.

### Liam Davis

Liam argued for conventional packaging and a clear reader contract. He rated
the explicit thesis approach at `10/10` and wanted the docs to behave like good
open-source documentation: direct, navigable, and predictable.

### Kira Neri

Kira reframed the deterministic layer as reproducibility rather than
bureaucracy. She rated that distinction at `9/10` and wanted the docs to speak
in terms of recoverability and repeatability.

## Consensus

The team did not agree on which philosophy was more important, but it did
agree on the editorial strategy:

- keep the tension between organic association and deterministic validation
- state the thesis explicitly at the start
- add structural bridges between theory and implementation
- choose a primary audience or split the material into clearly labeled paths
- present code as operational proof, not as disconnected reference material

## Next Actions

1. Use the spec draft as the source of truth.
2. Keep the docs index as the entry point for the rest of the set.
3. Update supporting docs only when they add navigation, scope, or operational
   detail.
