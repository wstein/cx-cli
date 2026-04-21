// test-lane: contract

import { describe, expect, test } from "vitest";
import { getBuiltinNotesExtractProfiles } from "../../src/notes/extract.js";

describe("notes extract built-in profiles contract", () => {
  test("freezes the built-in profile names, target paths, anchors, and required sections", () => {
    const profiles = getBuiltinNotesExtractProfiles();

    expect(
      Object.keys(profiles).sort((left, right) =>
        left.localeCompare(right, "en"),
      ),
    ).toEqual(["arc42", "manual", "onboarding"]);

    expect(profiles.arc42?.targetPaths).toEqual([
      "docs/modules/ROOT/pages/architecture/index.adoc",
    ]);
    expect(profiles.arc42?.requiredNotes).toEqual([
      "Render Kernel Constitution",
    ]);
    expect(profiles.arc42?.sectionOrder).toEqual([
      "introduction-and-goals",
      "constraints",
      "solution-strategy",
      "building-block-view",
      "runtime-view",
      "cross-cutting-concepts",
      "quality-scenarios",
      "risks-and-technical-debt",
      "reference-notes",
    ]);
    expect(profiles.onboarding?.targetPaths).toEqual([
      "docs/modules/ROOT/pages/start-here/docs-index.adoc",
    ]);
    expect(profiles.onboarding?.requiredNotes).toEqual([
      "Agent Operating Model",
    ]);
    expect(profiles.onboarding?.sectionOrder).toEqual([
      "mental-models",
      "core-workflows",
      "core-architecture",
      "quality-and-guardrails",
      "reference-notes",
    ]);
    expect(profiles.manual?.targetPaths).toEqual([
      "docs/modules/ROOT/pages/manual/operator-manual.adoc",
    ]);
    expect(profiles.manual?.requiredNotes).toEqual([
      "Friday To Monday Workflow Contract",
    ]);
    expect(profiles.manual?.sectionOrder).toEqual([
      "core-workflows",
      "commands-and-behavior",
      "validation-and-troubleshooting",
      "release-and-integrity",
      "reference-notes",
    ]);
  });
});
