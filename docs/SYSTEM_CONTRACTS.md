<!-- Source: SYSTEM_CONTRACTS.md | Status: CANONICAL | Stability: STABLE -->

# CX System Contracts

This document defines the operational contracts that sit under the mental model:

- the **cognition contract** for durable repository knowledge
- the **boundary contract** for what must never mix across surfaces
- the **trust propagation model** for how confidence moves through the system

See: [MENTAL_MODEL.md](MENTAL_MODEL.md) for the canonical semantics of the CX triad, Track A vs Track B, policy tiers, and artifact lifecycle.

## Cognition Contract V1

`cx` now distinguishes between a note that is merely parseable and a note that is fit to become durable repository memory.

The minimum cognition contract is:

1. a note must have a stand-alone summary paragraph
2. that summary must contain enough substance to route from quickly
3. template boilerplate must not survive into committed notes
4. the note must stay atomic enough for humans and agents to classify quickly
5. manifests must carry explicit cognition metadata instead of pretending every valid note is equally trustworthy

Current enforcement is intentionally narrow and machine-checkable:

- summary required
- summary must be non-trivial
- untouched template prompts are rejected
- note size limits remain enforced

Current scoring is intentionally diagnostic, not philosophical. `cx` measures observable signals such as summary density, structural clarity, evidence links, note age, and code-drift pressure. It does not claim to prove that the idea itself is true.

The test strategy now treats cognition quality as an adversarial surface. Unit coverage exercises sparse, boilerplate, stale, and high-signal notes separately so future refactors do not collapse the distinction between parseable memory and durable repository knowledge.

Why this protects you: `valid note != good note`. The cognition contract narrows that gap by refusing obvious low-signal memory and by making the remaining quality signals explicit in manifests and CLI review.

## Boundary Contract

The system stays trustworthy only if certain boundaries remain hard.

### Track Boundaries

- **Track B** may investigate, search, diagnose, and preserve hypotheses.
- **Track B** must not claim promotable artifact truth.
- **Track A** may freeze, validate, verify, and extract proof-grade artifacts.
- **Track A** must not pretend that unverified live state is already handoff-safe.

### Surface Boundaries

- **MCP** may expose live workspace state, but CI must never treat MCP output as promotable proof.
- **Bundles** may carry note summaries and trust metadata, but they are the proof surface only after validation and verification.
- **Notes** may preserve reasoning, but they remain conditional knowledge until humans or later proof paths confirm them.
- **CI** may trust Track A outputs and governance reports, but it must not trust exploratory Track B state as release evidence.

### Mutation Boundaries

- default MCP sessions must not cross from analysis into mutation silently
- note mutation requires an explicit trust decision
- dirty local convenience bundles must not be mistaken for promotable artifacts

Why this protects you: once boundaries blur, the system stops being a trust system and becomes a bag of smart features with no reliable handoff semantics.

## Trust Propagation Model

Trust moves through `cx` asymmetrically:

The shorthand is:

- **Source tree: trusted**
- **Notes: conditional**
- **Agent output: untrusted until verified**
- **Bundle: trusted**

| Surface | Trust level | Why |
| --- | --- | --- |
| Source tree selected from the VCS master list | **trusted** | It is the canonical input set for planning and later verification |
| Notes that pass governance | **conditional** | They are durable reasoning, but still claims about the system rather than proof of it |
| Agent outputs and live reasoning traces | **untrusted until verified** | They may be useful, but they are not handoff-safe evidence by themselves |
| Bundle artifacts that pass validation and verification | **trusted** | They are the proof surface frozen under manifest, checksum, and verification rules |

Manifest trust metadata exists so downstream automation can see that difference directly instead of inferring it from prose. Manifest traceability metadata now also points to the concrete audit path: `cx bundle` as the Track A command, `cx notes check` as the note-governance review gate, and `.cx/audit.log` as the MCP decision ledger for agent actions.

Why this protects you: bad reasoning should not gain the same standing as verified artifacts just because it was serialized into Markdown or emitted by an agent.

## What This Does Not Claim

These contracts do **not** prove:

- that a note is factually correct
- that a summary is complete
- that an agent decision was optimal
- that a repository never contains stale knowledge

Those remain review and future-system concerns. The current contract is about refusing obvious low-signal cognition, keeping boundaries explicit, and propagating trust labels honestly.
