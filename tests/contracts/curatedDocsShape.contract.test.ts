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

describe("curated docs shape contract", () => {
  test("top-level curated navigation stays start-here, manual, architecture, then deep reference", async () => {
    const nav = await readText("docs/modules/ROOT/nav.adoc");

    const startHereIndex = nav.indexOf("* xref:index.adoc[Start Here]");
    const manualIndex = nav.indexOf("** xref:manual:index.adoc[Manual]");
    const architectureIndex = nav.indexOf(
      "** xref:architecture:index.adoc[Architecture]",
    );
    const repositoryIndex = nav.indexOf(
      "include::partial$repository-nav.adoc[]",
    );

    expect(startHereIndex).toBeGreaterThanOrEqual(0);
    expect(manualIndex).toBeGreaterThan(startHereIndex);
    expect(architectureIndex).toBeGreaterThan(manualIndex);
    expect(repositoryIndex).toBeGreaterThan(architectureIndex);
  });

  test("docs index keeps repository references as deep reference rather than front-door onboarding", async () => {
    const docsIndex = await readText(
      "docs/modules/onboarding/pages/index.adoc",
    );
    const governance = await readText(
      "docs/modules/ROOT/pages/repository/docs/governance.adoc",
    );

    expect(docsIndex).toContain("== Start Here");
    expect(docsIndex).toContain("== Reference By Concern");
    expect(docsIndex).toContain("== Historical Material");
    expect(docsIndex).toContain("Agent setup and IDE integration:");
    expect(docsIndex).toContain("Read the Friday-to-Monday workflow first.");
    expect(governance).toContain("=== Front-Door Docs");
    expect(governance).toContain("=== Reference-Only Docs");
    expect(governance).toContain(
      "Agent integration and configuration docs should be linked by concern",
    );
    expect(governance).toContain(
      "If a new document would introduce another plausible place to start",
    );
  });
});
