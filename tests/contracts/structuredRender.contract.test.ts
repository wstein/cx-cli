// test-lane: contract
import { describe, expect, test } from "vitest";
import {
  computePlanHash,
  planToMaps,
  type StructuredRenderPlan,
  validateEntryHashes,
  validatePlanOrdering,
} from "../../src/repomix/structured.js";
import { sha256Text } from "../../src/shared/hashing.js";

function makePlan(styleTag: string): StructuredRenderPlan {
  const entries = [
    {
      path: "docs/guide.md",
      content: `# Guide\n\nstyle=${styleTag}\n`,
      sha256: sha256Text(`# Guide\n\nstyle=${styleTag}\n`),
      tokenCount: 10,
    },
    {
      path: "src/index.ts",
      content: `export const style = "${styleTag}";\n`,
      sha256: sha256Text(`export const style = "${styleTag}";\n`),
      tokenCount: 8,
    },
  ].sort((left, right) => left.path.localeCompare(right.path));

  return {
    entries,
    ordering: entries.map((entry) => entry.path),
  };
}

describe("structured render contract", () => {
  test("produces deterministic ordering", () => {
    const plan = makePlan("xml");
    expect(validatePlanOrdering(plan)).toBe(true);
    expect(plan.ordering).toEqual(["docs/guide.md", "src/index.ts"]);
  });

  test("validates entry hashes for intact plans", () => {
    const plan = makePlan("markdown");
    expect(validateEntryHashes(plan.entries).size).toBe(0);
  });

  test("detects entry hash drift", () => {
    const plan = makePlan("plain");
    const original = plan.entries[0];
    if (!original) {
      throw new Error("Missing plan entry");
    }
    const drifted = {
      ...original,
      content: `${original.content}tampered\n`,
    };
    const errors = validateEntryHashes([drifted, ...plan.entries.slice(1)]);
    expect(errors.size).toBe(1);
    expect(errors.get("docs/guide.md")).toContain("hash mismatch");
  });

  test("keeps path-to-metadata maps aligned with entries", () => {
    const plan = makePlan("json");
    const maps = planToMaps(plan);
    expect(maps.fileTokenCounts.get("docs/guide.md")).toBe(10);
    expect(maps.fileTokenCounts.get("src/index.ts")).toBe(8);
    expect(maps.fileContentHashes.get("docs/guide.md")).toBe(
      sha256Text("# Guide\n\nstyle=json\n"),
    );
  });

  test("changes plan hash when logical plan changes", () => {
    const xmlPlan = makePlan("xml");
    const markdownPlan = makePlan("markdown");
    expect(computePlanHash(xmlPlan)).not.toBe(computePlanHash(markdownPlan));
  });

  test("keeps plan hash stable for equivalent plans", () => {
    const left = makePlan("xml");
    const right = makePlan("xml");
    expect(computePlanHash(left)).toBe(computePlanHash(right));
  });
});
