// test-lane: integration

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  analyzeDocsExportMarkdown,
  exportAntoraDocsToMarkdown,
} from "../../src/docs/export.js";

async function makeOutputRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "cx-docs-export-"));
}

describe("docs export", () => {
  test("exports built-in Antora docs surfaces to multimarkdown files", async () => {
    const outputDir = await makeOutputRoot();

    const artifacts = await exportAntoraDocsToMarkdown({
      workspaceRoot: process.cwd(),
      outputDir,
    });

    expect(artifacts.map((artifact) => artifact.outputFile)).toEqual([
      "onboarding.mmd",
      "manual.mmd",
      "architecture.mmd",
    ]);

    const onboarding = await fs.readFile(
      path.join(outputDir, "onboarding.mmd"),
      "utf8",
    );
    expect(onboarding).toContain("# CX Documentation Index");
    expect(onboarding).toContain("Track A produces proof-grade artifacts");
    expect(onboarding).not.toContain(
      "include::ROOT:partial$track-primer.adoc[]",
    );
    expect(analyzeDocsExportMarkdown(onboarding)).toEqual({
      status: "clean",
      diagnostics: [],
    });
    expect(onboarding).toContain("(manual.mmd#release-checklist)");

    const manual = await fs.readFile(
      path.join(outputDir, "manual.mmd"),
      "utf8",
    );
    expect(manual).toContain("# Operator Manual Overview");
    expect(manual).toContain("# CX Operator Manual");
    expect(analyzeDocsExportMarkdown(manual)).toEqual({
      status: "clean",
      diagnostics: [],
    });
    expect(manual).toContain("(#cx-operator-manual)");

    const architecture = await fs.readFile(
      path.join(outputDir, "architecture.mmd"),
      "utf8",
    );
    expect(architecture).toContain("# Architecture Overview");
    expect(architecture).toContain("[Mental Model](#cx-mental-model)");
    expect(analyzeDocsExportMarkdown(architecture)).toEqual({
      status: "clean",
      diagnostics: [],
    });

    for (const artifact of artifacts) {
      expect(artifact.pageCount).toBeGreaterThan(0);
      expect(artifact.sourcePaths.length).toBe(artifact.pageCount);
      expect(artifact.sha256).toMatch(/^[0-9a-f]{64}$/u);
      expect(artifact.sizeBytes).toBeGreaterThan(0);
      expect(artifact.diagnostics).toEqual({
        status: "clean",
        diagnostics: [],
      });
    }
  });

  test("supports a caller-provided filename prefix", async () => {
    const outputDir = await makeOutputRoot();

    const artifacts = await exportAntoraDocsToMarkdown({
      workspaceRoot: process.cwd(),
      outputDir,
      filenamePrefix: "demo",
    });

    expect(artifacts.map((artifact) => artifact.outputFile)).toEqual([
      "demo-onboarding.mmd",
      "demo-manual.mmd",
      "demo-architecture.mmd",
    ]);
  });
});
