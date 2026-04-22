// test-lane: integration

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { exportAntoraDocsToMarkdown } from "../../src/docs/export.js";

const outputRoots: string[] = [];

async function makeOutputRoot(): Promise<string> {
  const outputRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "cx-docs-export-clean-"),
  );
  outputRoots.push(outputRoot);
  return outputRoot;
}

afterEach(async () => {
  await Promise.all(
    outputRoots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("docs export link contract", () => {
  test("rewrites Antora-flavored xrefs into review-friendly links", async () => {
    const outputDir = await makeOutputRoot();

    await exportAntoraDocsToMarkdown({
      workspaceRoot: process.cwd(),
      outputDir,
    });

    const onboarding = await fs.readFile(
      path.join(outputDir, "onboarding.mmd"),
      "utf8",
    );

    expect(onboarding).toContain("(manual.mmd#release-checklist)");
    expect(onboarding).toContain("(architecture.mmd#cx-system-map)");
    expect(onboarding).toContain(
      "(repository/docs/governance.html#mcp-tool-stability)",
    );
    expect(onboarding).not.toContain("(manual:release-and-integrity.html");
    expect(onboarding).not.toContain("(architecture:system-map.html)");
    expect(onboarding).not.toContain(
      "(ROOT:page$repository/docs/governance.html",
    );
    expect(onboarding).not.toContain("xref:");
  });
});
