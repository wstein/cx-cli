<!-- Source: MENTAL_MODEL.md | Status: CANONICAL | Stability: STABLE -->

# CX Mental Model

This is the canonical semantics and operator model for `cx`.

See: [OPERATING_MODES.md](OPERATING_MODES.md) for the shortest path to choosing the right surface before reading the deeper model.
See: [SYSTEM_MAP.md](SYSTEM_MAP.md) for the compressed one-page view.
See: [SYSTEM_CONTRACTS.md](SYSTEM_CONTRACTS.md) for cognition quality, hard boundaries, and trust propagation.

When another document needs to explain the CX triad, Track A vs Track B, MCP policy tiers, or the artifact lifecycle, it should point here instead of restating the full model.

## CX Triad

`cx` is built around three cooperating surfaces:

1. **Immutable snapshots**: `cx bundle` writes a deterministic artifact set that can be validated, verified, transported, and audited later.
2. **Live agent protocol**: `cx mcp` exposes the current workspace through scoped MCP tools for search, reads, planning, diagnostics, and note operations.
3. **Durable knowledge**: `cx notes` keeps repository knowledge in versioned atomic notes that can be queried directly and carried into manifests.

The triad is deliberate: bundles carry stable truth across time, MCP handles live investigation, and notes preserve reasoning that should survive both.

## Track A Vs B

`cx` has two operating tracks. They share the same workspace boundary, file-selection rules, hashing model, and safety invariants. They solve different problems.

The shortest framing is:

- **Track B = hypothesis generation**
- **Track A = proof generation**
- **Notes are the durable cognition layer.**

Track B is where an agent or operator asks "what might be true, what should I inspect next, and what reasoning should I preserve?" Track A is where the system answers "what can we now prove, freeze, verify, and hand off?"

| Track | Primary question | Main commands | Output | Use it when |
| --- | --- | --- | --- | --- |
| **Track A: Proof Generation** | "What exact artifact can we prove and hand off?" | `cx inspect`, `cx bundle`, `cx validate`, `cx verify`, `cx extract` | Immutable bundle artifacts plus manifest, lock file, and checksums | You need something reviewable, reproducible, and verifiable later |
| **Track B: Hypothesis Generation** | "What is true in the workspace right now, and what should we examine next?" | `cx mcp`, `cx doctor *`, `cx notes *` | Live workspace reads, plan previews, diagnostics, and note maintenance | You need interactive investigation, note updates, or agent guidance during active work |

Rule of thumb:

- Use **Track B** to understand, search, diagnose, and document.
- Use **Track A** to freeze, verify, and hand off.
- Treat **notes as the durable cognition layer** between exploration and proof.
- Switch from B to A when the work stops being exploratory and starts becoming an artifact contract.

The notes surface sits between them as the durable cognition layer. It preserves high-signal reasoning so later Track B sessions do not have to rediscover everything from raw code, and later Track A bundles can carry that reasoning forward in manifest metadata.

The trust shorthand is:

- **Source tree: trusted**
- **Notes: conditional**
- **Agent output: untrusted until verified**
- **Bundle: trusted**

## Policy Tiers

Policy tiers apply to the live MCP surface, not to immutable bundle semantics. Bundle invariants stay hard stops regardless of MCP policy.

| MCP policy | Allowed capabilities | Typical environment | Intended use |
| --- | --- | --- | --- |
| `strict` | read + observe | CI, shared runners, untrusted automation | Let agents inspect without mutating or planning freely |
| `default` | read + observe + plan | interactive engineering sessions | Let agents investigate and preview while humans keep mutation authority |
| `unrestricted` | read + observe + plan + mutate | trusted local development | Let agents operate with full workspace authority |

This is separate from tool stability tiers in [STABILITY.md](STABILITY.md). Stability answers "how locked is this interface?" Policy answers "what is this agent allowed to do right now?"

## Artifact Lifecycle

An artifact moves through a fixed lifecycle:

1. **Live workspace**
   - Code, docs, config, and notes are still changing.
   - Track B is the right place for investigation, note updates, and planning.
2. **Inspect**
   - `cx inspect` previews section membership, token counts, overlaps, and extraction implications before anything is written.
3. **Bundle**
   - `cx bundle` freezes the selected workspace state into section outputs, manifest, lock file, checksum sidecar, and copied assets.
4. **Validate**
   - `cx validate` checks structural integrity: the bundle contains the required files and the manifest/checksum contract is internally coherent.
5. **Verify**
   - `cx verify` proves the artifact set was not altered after bundling and can optionally compare the bundle back to a source tree with `--against`.
6. **Extract**
   - `cx extract` reconstructs files under manifest and hash guardrails instead of treating the bundle like a blind archive.

Why this protects you: every step narrows trust. Planning tells you what would be bundled. Bundling freezes it. Validation confirms the structure exists. Verification proves the artifact still matches what was written. Extraction refuses reconstructions that would break identity or line-coordinate trust.

## Friday To Monday

The practical handoff is simple:

- **Friday**: use Track B to investigate, update notes, and confirm the plan.
- **Friday closeout**: switch to Track A and write the bundle.
- **Monday**: validate or verify the handed-off artifact before trusting it.

See: [WORKFLOWS/friday-to-monday.md](WORKFLOWS/friday-to-monday.md)
