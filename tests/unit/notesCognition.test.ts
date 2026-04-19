// test-lane: unit
import { describe, expect, it } from "bun:test";

import {
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

    const assessment = assessNoteCognition(body, summary);

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
    expect(assessment.trustLevel).toBe("conditional");
  });

  it("keeps sparse but valid notes in low-signal review territory", () => {
    const summary = "This note remains valid but sparse today.";
    const body = `${summary}

It intentionally omits structure and supporting links for now.
`;

    const assessment = assessNoteCognition(body, summary);

    expect(assessment.templateBoilerplateDetected).toBe(false);
    expect(assessment.evidenceLinkCount).toBe(0);
    expect(assessment.score).toBe(35);
    expect(assessment.label).toBe("low_signal");
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

    const assessment = assessNoteCognition(body, summary);

    expect(assessment.templateBoilerplateDetected).toBe(true);
    expect(assessment.score).toBe(71);
    expect(assessment.label).toBe("review");
    expect(assessment.trustLevel).toBe("conditional");
  });
});
