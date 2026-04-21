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
      "docs/modules/architecture/pages/index.adoc",
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
    expect(profiles.arc42?.sectionTags).toEqual({
      "introduction-and-goals": ["docs", "onboarding", "architecture"],
      constraints: ["governance", "trust", "boundaries", "contract"],
      "solution-strategy": ["architecture", "kernel", "render", "notes"],
      "building-block-view": ["bundle", "manifest", "extract", "scanner"],
      "runtime-view": ["workflow", "mcp", "operator", "release"],
      "cross-cutting-concepts": ["determinism", "provenance", "hash", "oracle"],
      "quality-scenarios": ["testing", "ci", "coverage", "release"],
      "risks-and-technical-debt": [
        "backlog",
        "risk",
        "migration",
        "decommission",
      ],
    });
    expect(profiles.onboarding?.targetPaths).toEqual([
      "docs/modules/onboarding/pages/index.adoc",
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
    expect(profiles.onboarding?.sectionTags).toEqual({
      "mental-models": ["onboarding", "mental-model", "architecture", "notes"],
      "core-workflows": ["workflow", "operator", "manual", "mcp"],
      "core-architecture": ["bundle", "render", "kernel", "scanner"],
      "quality-and-guardrails": [
        "testing",
        "governance",
        "release",
        "contract",
      ],
    });
    expect(profiles.manual?.targetPaths).toEqual([
      "docs/modules/manual/pages/operator-manual.adoc",
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
    expect(profiles.manual?.sectionTags).toEqual({
      "core-workflows": ["workflow", "manual", "operator", "mcp"],
      "commands-and-behavior": ["cli", "bundle", "extract", "scanner"],
      "validation-and-troubleshooting": [
        "validate",
        "verify",
        "testing",
        "troubleshooting",
      ],
      "release-and-integrity": ["release", "ci", "governance", "contract"],
    });
  });
});
