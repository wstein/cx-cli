// test-lane: contract

import { describe, expect, test } from "vitest";
import { getBuiltinNotesExtractProfiles } from "../../src/notes/extract.js";

describe("notes extract built-in profiles contract", () => {
  test("freezes the built-in profile names, target paths, anchors, and required sections", () => {
    const profiles = getBuiltinNotesExtractProfiles();

    expect(profiles.architecture?.includeTargets).toEqual(["current"]);
    expect(profiles.arc42?.includeTargets).toEqual(["current"]);
    expect(profiles.onboarding?.includeTargets).toEqual(["current"]);
    expect(profiles.manual?.includeTargets).toEqual(["current"]);

    expect(
      Object.keys(profiles).sort((left, right) =>
        left.localeCompare(right, "en"),
      ),
    ).toEqual(["arc42", "architecture", "manual", "onboarding"]);
    expect(profiles.arc42).toBe(profiles.architecture);

    expect(profiles.arc42?.targetPaths).toEqual([
      "docs/modules/architecture/pages/index.adoc",
    ]);
    expect(profiles.arc42?.llm.instructions).toBe(
      "Update arc42-style architecture documentation in AsciiDoc. Treat the codebase and notes as the single source of truth. Do not invent new invariants. Surface conflicts explicitly. Prefer explanation over note concatenation. Update only the relevant chapters and use partials when useful.",
    );
    expect(profiles.arc42?.llm.mustIncludeProvenance).toBe(false);
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
        "deferred",
        "risk",
        "migration",
        "decommission",
      ],
    });
    expect(profiles.onboarding?.targetPaths).toEqual([
      "docs/modules/onboarding/pages/index.adoc",
    ]);
    expect(profiles.onboarding?.llm.instructions).toBe(
      "Update onboarding documentation in AsciiDoc. Treat the codebase and notes as the single source of truth. Define core concepts before details. Explain why the project is built this way. Update only the relevant chapters and use partials when useful. Point readers back to durable reference where precision matters.",
    );
    expect(profiles.onboarding?.llm.mustIncludeProvenance).toBe(false);
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
      "docs/modules/manual/pages/index.adoc",
    ]);
    expect(profiles.manual?.llm.instructions).toBe(
      "Update task-oriented manual content in AsciiDoc. Treat the codebase and notes as the single source of truth. Prefer workflows and commands. Explain inputs, outputs, validation checks, and failure modes. Update only the relevant chapters and use partials when useful. Preserve uncertainty.",
    );
    expect(profiles.manual?.llm.mustIncludeProvenance).toBe(false);
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
