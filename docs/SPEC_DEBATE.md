# CX Spec Debate Record

This record captures an intentionally contentious internal review of the `cx` draft so the implementation starts from explicit tradeoffs instead of vague agreement.

## Participants

- Dr. Arthur Pendelton, university CS professor
- Elena Rostova, principal software engineer
- Julian Vance, senior technical writer
- Maya Lin, principal software architect
- Marcus Chen, principal security specialist
- Chloe Bennett, AI workflow specialist
- Rachel Brooks, project manager
- Samir Patel, principal QA engineer
- Liam Davis, open-source maintainer
- Kira Neri, senior DevOps engineer

## Debate

### 1. Separate tool vs. extending Repomix

Arthur:
The draft is right to keep `cx` separate. A wrapper with a public-library boundary preserves semantics and keeps the formal model simple. Rating: 9/10.

Elena:
I agree on separation, but the current text is too trusting about Repomix exports. A package can call something “public” and still break behaviorally. We need an internal adapter contract plus compatibility tests. Rating: 8/10.

Maya:
The architectural risk is not separation itself, but leakage. If section planning depends on Repomix internals later, the clean boundary will rot. We should lock a single adapter interface now and forbid deep imports in CI. Rating: 10/10.

Liam:
From a maintainer perspective, a separate package is the only realistic posture. Forking Repomix would turn this into permanent patch-chasing. Rating: 9/10.

Counterpoint from Chloe:
Separation is good, but we should admit one downside: users will expect parity with Repomix flags. Our own config surface must map clearly or we create confusing half-compatibility.

Consensus:
Keep `cx` as a separate package, but formalize an adapter boundary and test around public integration assumptions.

### 2. Overlap policy: fail vs. deduplicate

Rachel:
The default should stay `fail`. Ambiguous ownership ruins delivery later because every downstream command inherits the ambiguity. Rating: 9/10.

Samir:
Strong agreement. A “first wins” fallback is acceptable only if ordering is explicitly documented and test-covered. Hidden precedence would be a bug farm. Rating: 10/10.

Arthur:
The spec is correct mathematically but weak operationally. It should distinguish “no match” from “multi-match” in diagnostics and provide deterministic examples. Rating: 7/10.

Elena responding:
Yes, and we should surface the exact matching include patterns in the error. Engineers will not tolerate “overlap detected” without context.

Consensus:
`fail` remains the default, `first-wins` remains opt-in, and overlap errors must show file path plus competing sections.

### 3. TOON manifest vs. JSON manifest

Julian:
TOON is readable and aligns with the request, but the draft understates the cost. We need stable quoting rules or paths with spaces will become ambiguous. Rating: 6/10.

Chloe:
Machine-oriented workflows benefit from a table-oriented manifest, but only if parsing is deterministic. If TOON has edge cases, we should author a disciplined subset rather than an informal pretty-printer. Rating: 8/10.

Marcus:
Any custom text format expands the attack surface for parser confusion. Deterministic escaping and strict validation are mandatory. Rating: 7/10.

Maya responding:
I do not want a dual-manifest system in v1. That doubles invariants. Better to keep TOON as the source of truth and define a canonical subset precisely.

Consensus:
Keep TOON, but define a canonical subset with explicit scalar escaping and table column ordering.

### 4. Span tracking

Arthur:
The draft’s “never guess” rule is the best sentence in the document. Keep it. Rating: 10/10.

Elena:
Agreed, but line spans should be omitted by default until Repomix integration proves exactness. Shipping fabricated spans would be worse than shipping none. Rating: 10/10.

Samir:
We also need regression tests that assert absence, not just presence. Empty metadata is a legitimate state. Rating: 9/10.

Consensus:
Exact spans only. Omission is valid and should be tested explicitly.

### 5. Production readiness vs. MVP shortcuts

Marcus:
The draft says “strict” but still implies placeholders in a few module skeletons. That is fine for notes, not for code. Every implemented command must either work end-to-end or fail with a precise typed error. Rating: 9/10.

Kira:
I care about determinism more than breadth. If we have to choose, we should finish a narrow command set with reproducible outputs before chasing all styles and subcommands. Rating: 10/10.

Rachel responding:
That means phase boundaries need acceptance criteria, not just feature names.

Consensus:
Prefer complete narrow slices over broad partial ones. Each phase must ship buildable code, tests, docs, and a clean commit.

## Final Decisions

- `cx` stays a separate package with a narrow Repomix adapter.
- Overlap detection fails by default and diagnostics must be specific.
- TOON remains authoritative, but only as a canonical escaped subset.
- Output spans are optional metadata and only emitted when exact.
- Phase delivery favors deterministic, complete slices over feature sprawl.

## Future Developments

- Add compatibility tests against installed Repomix versions.
- Add extraction once the parser coverage for each supported style is exact.
- Add CI rules that forbid deep Repomix imports and enforce manifest determinism.

## Concrete Improvements

- Define canonical scalar escaping for TOON now.
- Freeze sort rules for sections, assets, and file rows.
- Make the Repomix adapter injectable so tests stay independent of npm availability.
- Treat missing Repomix integration as a typed runtime capability error, not a vague exception.
