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
  test("exports Antora assemblies to multimarkdown files", async () => {
    const outputDir = await makeOutputRoot();

    const artifacts = await exportAntoraDocsToMarkdown({
      workspaceRoot: process.cwd(),
      outputDir,
    });

    expect(artifacts.map((artifact) => artifact.outputFile)).toEqual([
      "architecture.mmd",
      "docs-index.mmd",
      "manual.mmd",
      "start-here.mmd",
    ]);

    const docsIndex = await fs.readFile(
      path.join(outputDir, "docs-index.mmd"),
      "utf8",
    );
    expect(docsIndex).toContain("# CX Documentation: Docs Index");
    expect(docsIndex).toContain("Track A produces proof-grade artifacts");
    expect(docsIndex).toContain("start-here.mmd#notes-governance");
    expect(docsIndex).not.toContain("ROOT:page$");
    expect(analyzeDocsExportMarkdown(docsIndex)).toEqual({
      status: "clean",
      diagnostics: [],
    });

    const manual = await fs.readFile(
      path.join(outputDir, "manual.mmd"),
      "utf8",
    );
    expect(manual).toContain("# CX Documentation: Manual");
    expect(manual).toContain("Agent Integration Guide");
    expect(analyzeDocsExportMarkdown(manual)).toEqual({
      status: "clean",
      diagnostics: [],
    });
    expect(manual).toContain("start-here.mmd");

    const architecture = await fs.readFile(
      path.join(outputDir, "architecture.mmd"),
      "utf8",
    );
    expect(architecture).toContain("# CX Documentation: Architecture");
    expect(architecture).toContain("start-here.mmd#architecture:mental-model");
    expect(analyzeDocsExportMarkdown(architecture)).toEqual({
      status: "clean",
      diagnostics: [],
    });

    const startHere = await fs.readFile(
      path.join(outputDir, "start-here.mmd"),
      "utf8",
    );
    expect(startHere).toContain("# CX Documentation: Start Here");
    expect(startHere).toContain("repository-docs-agent_integration");
    expect(analyzeDocsExportMarkdown(startHere)).toEqual({
      status: "clean",
      diagnostics: [],
    });

    for (const artifact of artifacts) {
      expect(artifact.pageCount).toBeGreaterThan(0);
      expect(artifact.sourcePaths.length).toBe(artifact.pageCount);
      expect(artifact.sha256).toMatch(/^[0-9a-f]{64}$/u);
      expect(artifact.sizeBytes).toBeGreaterThan(0);
      expect(artifact.rootLevel).toBe(1);
      expect(artifact.diagnostics).toEqual({
        status: "clean",
        diagnostics: [],
      });
    }
  }, 30_000);

  test("supports a caller-provided filename prefix", async () => {
    const outputDir = await makeOutputRoot();

    const artifacts = await exportAntoraDocsToMarkdown({
      workspaceRoot: process.cwd(),
      outputDir,
      filenamePrefix: "demo",
    });

    expect(artifacts.map((artifact) => artifact.outputFile)).toEqual([
      "demo-architecture.mmd",
      "demo-docs-index.mmd",
      "demo-manual.mmd",
      "demo-start-here.mmd",
    ]);
  }, 20_000);
});
