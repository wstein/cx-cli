// test-lane: unit
import { describe, expect, it } from "vitest";

import {
  applyContradictionPressure,
  assessNoteCognition,
  hasNonTrivialSummary,
} from "../../src/notes/cognition.js";

describe("notes cognition", () => {
  it("requires at least six words for a non-trivial summary", () => {
    expect(hasNonTrivialSummary("five words are too short")).toBe(false);
    expect(hasNonTrivialSummary("six words are enough for routing now")).toBe(
      true,
    );
  });

  it("scores rich notes as high signal and conditional trust", () => {
    const summary =
      "This note captures the verified rendering boundary for bundle planning decisions safely.";
    const body = `${summary}

## What

See [[Render Plan Cache]] and [[src/bundle/verify.ts]] for the verification flow.

## Why

Review [system contracts](../docs/SYSTEM_CONTRACTS.md) before changing the trust boundary.

## How

- \`src/notes/validate.ts\` - keep cognition enforcement aligned with manifest routing.
`;

    const assessment = assessNoteCognition(body, summary, undefined, {
      noteId: "20260413123036",
      now: new Date("2026-04-19T00:00:00Z"),
    });

    expect(assessment.summaryWordCount).toBeGreaterThanOrEqual(12);
    expect(assessment.noteLinkCount).toBe(1);
    expect(assessment.codeLinkCount).toBe(1);
    expect(assessment.localLinkCount).toBe(2);
    expect(assessment.evidenceLinkCount).toBeGreaterThanOrEqual(3);
    expect(assessment.structureSignals).toEqual({
      what: true,
      why: true,
      how: true,
    });
    expect(assessment.score).toBe(100);
    expect(assessment.label).toBe("high_signal");
    expect(assessment.stalenessLabel).toBe("fresh");
    expect(assessment.trustLevel).toBe("conditional");
  });

  it("keeps sparse but valid notes in low-signal review territory", () => {
    const summary = "This note remains valid but sparse today.";
    const body = `${summary}

It intentionally omits structure and supporting links for now.
`;

    const assessment = assessNoteCognition(body, summary, undefined, {
      noteId: "20260413123037",
      now: new Date("2026-04-19T00:00:00Z"),
    });

    expect(assessment.templateBoilerplateDetected).toBe(false);
    expect(assessment.evidenceLinkCount).toBe(0);
    expect(assessment.score).toBe(35);
    expect(assessment.label).toBe("low_signal");
    expect(assessment.stalenessLabel).toBe("fresh");
    expect(assessment.trustLevel).toBe("conditional");
  });

  it("flags untouched template boilerplate so it cannot masquerade as strong knowledge", () => {
    const summary =
      "This summary has enough words to pass the minimum routing gate safely.";
    const body = `${summary}

Summarize the note in one or two sentences so agents can route to it quickly from the manifest.

## What

See [[Routing Note]].

## Why

State the durable fact, mechanism, decision, or failure mode.
`;

    const assessment = assessNoteCognition(body, summary, undefined, {
      noteId: "20260413123038",
      now: new Date("2026-04-19T00:00:00Z"),
    });

    expect(assessment.templateBoilerplateDetected).toBe(true);
    expect(assessment.score).toBe(71);
    expect(assessment.label).toBe("review");
    expect(assessment.trustLevel).toBe("conditional");
  });

  it("applies age penalties before a note becomes structurally invalid", () => {
    const summary =
      "This note still routes correctly even after a long quiet period.";
    const body = `${summary}

## What

See [[System Trust Contract]] for the governing rule.

## Why

Long-lived knowledge needs explicit freshness pressure to stay trustworthy.
`;

    const assessment = assessNoteCognition(body, summary, undefined, {
      noteId: "20240113123038",
      now: new Date("2026-04-19T00:00:00Z"),
    });

    expect(assessment.ageDays).toBeGreaterThanOrEqual(800);
    expect(assessment.stalenessLabel).toBe("stale");
    expect(assessment.agePenalty).toBe(14);
    expect(assessment.score).toBeLessThan(assessment.baseScore);
  });

  it("applies contradiction penalties separately from age and drift pressure", () => {
    const summary =
      "This note still routes correctly even when contradictions are detected later.";
    const body = `${summary}

## What

See [[System Trust Contract]] for the governing rule.
`;

    const assessment = assessNoteCognition(body, summary, undefined, {
      noteId: "20260413123039",
      now: new Date("2026-04-19T00:00:00Z"),
    });
    const contradicted = applyContradictionPressure(assessment, 2);

    expect(contradicted.contradictionCount).toBe(2);
    expect(contradicted.contradictionPenalty).toBe(30);
    expect(contradicted.score).toBeLessThan(assessment.score);
  });
});
