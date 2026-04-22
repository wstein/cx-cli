// test-lane: integration

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { exportAntoraDocsToMarkdown } from "../../src/docs/export.js";

const outputRoots: string[] = [];

async function makeOutputRoot(): Promise<string> {
  const outputRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "cx-docs-export-defects-"),
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

describe("docs export current defects", () => {
  test("still leaks module-qualified and Antora-family flavored links in rendered review output", async () => {
    const outputDir = await makeOutputRoot();

    await exportAntoraDocsToMarkdown({
      workspaceRoot: process.cwd(),
      outputDir,
    });

    const onboarding = await fs.readFile(
      path.join(outputDir, "onboarding.mmd"),
      "utf8",
    );

    expect(onboarding).toContain("(manual:release-and-integrity.html");
    expect(onboarding).toContain("(architecture:system-map.html)");
    expect(onboarding).toContain("(ROOT:page$repository/docs/governance.html");
  });
});
