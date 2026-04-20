// test-lane: contract

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function readText(relativePath: string): Promise<string> {
  return fs.readFile(path.join(ROOT, relativePath), "utf8");
}

describe("Antora arc42 spine contract", () => {
  test("architecture overview and nav keep the arc42 spine ordered and explicit", async () => {
    const nav = await readText("docs/antora/modules/ROOT/nav.adoc");
    const architectureIndex = await readText(
      "docs/antora/modules/ROOT/pages/architecture/index.adoc",
    );

    const expectedSections = [
      "01-introduction-and-goals",
      "02-constraints",
      "03-context-and-scope",
      "04-solution-strategy",
      "05-building-block-view",
      "06-runtime-view",
      "07-deployment-view",
      "08-cross-cutting-concepts",
      "09-decisions-and-history",
      "10-quality-requirements",
      "11-risks",
      "12-glossary",
    ];

    let lastIndex = -1;
    for (const section of expectedSections) {
      const navNeedle = `xref:architecture/${section}.adoc`;
      const currentIndex = nav.indexOf(navNeedle);
      expect(currentIndex).toBeGreaterThan(lastIndex);
      lastIndex = currentIndex;
      expect(architectureIndex).toContain(navNeedle);
    }

    expect(architectureIndex).toContain("uses arc42 as the architecture spine");
    expect(architectureIndex).toContain(
      "The `notes/` graph is not part of the arc42 spine.",
    );
  });
});
