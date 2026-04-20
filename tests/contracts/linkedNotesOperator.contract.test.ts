// test-lane: contract
/**
 * Operator-surface contract for linked-note enrichment.
 *
 * Verifies that the inclusion changes made by enrichPlanWithLinkedNotes are
 * visible through the same inspection surface used by `cx inspect --json`.
 * This complements tests/planning/linkedNotes.test.ts, which covers the
 * planner internals; this file covers the operator-facing output layer.
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { DEFAULT_BEHAVIOR_VALUES } from "../../src/config/defaults.js";
import type { CxConfig } from "../../src/config/types.js";
import { collectInspectReport } from "../../src/inspect/report.js";

let testDir: string;

const writeNote = async (
  notesDir: string,
  id: string,
  title: string,
  body = "",
): Promise<void> => {
  const summary = `This note captures durable context about ${title} for linked-note enrichment coverage and operator-facing inspection.`;
  const noteBody = body.length > 0 ? `${summary}\n\n${body}` : summary;
  const content = `---
id: ${id}
aliases: []
tags: []
target: current
---

${noteBody}

## Links

`;
  await fs.writeFile(path.join(notesDir, `${id}-${title}.md`), content);
};

function baseConfig(root: string): CxConfig {
  return {
    schemaVersion: 1,
    projectName: "operator-contract",
    sourceRoot: root,
    outputDir: path.join(root, "dist", "operator-bundle"),
    output: {
      extensions: {
        xml: ".xml.txt",
        json: ".json.txt",
        markdown: ".md",
        plain: ".txt",
      },
    },
    repomix: {
      style: "xml",
      showLineNumbers: false,
      includeEmptyDirectories: false,
      securityCheck: false,
    },
    files: {
      include: [],
      exclude: ["dist/**"],
      followSymlinks: false,
      unmatched: "ignore",
    },
    dedup: {
      mode: "fail",
      order: "config",
      requireExplicitOwnership: false,
    },
    manifest: {
      format: "json",
      pretty: true,
      includeFileSha256: true,
      includeOutputSha256: true,
      includeOutputSpans: true,
      includeSourceMetadata: true,
    },
    handover: {
      includeRepoHistory: false,
      repoHistoryCount: 25,
    },
    notes: {
      strictNotesMode: false,
      failOnDriftPressuredNotes: false,
      appliesToSections: [],
    },
    scanner: {
      mode: "warn",
    },
    checksums: {
      algorithm: "sha256",
      fileName: "operator-contract.sha256",
    },
    tokens: {
      encoding: "o200k_base",
    },
    behavior: {
      ...DEFAULT_BEHAVIOR_VALUES,
    },
    behaviorSources: {
      dedupMode: "compiled default",
      repomixMissingExtension: "compiled default",
      configDuplicateEntry: "compiled default",
      assetsLayout: "compiled default",
    },
    mcp: {
      policy: "default",
      auditLogging: true,
    },
    assets: {
      include: [],
      exclude: [],
      mode: "copy",
      targetDir: "operator-assets",
      layout: "flat",
    },
    sections: {
      docs: {
        include: ["docs/**"],
        exclude: [],
      },
      src: {
        include: ["src/**"],
        exclude: [],
      },
    },
  };
}

beforeEach(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-linked-notes-op-"));
  await fs.mkdir(path.join(testDir, "notes"), { recursive: true });
  await fs.mkdir(path.join(testDir, "src"), { recursive: true });
  await fs.mkdir(path.join(testDir, "docs"), { recursive: true });
  await fs.writeFile(
    path.join(testDir, "src", "index.ts"),
    "export const x = 1;\n",
  );
  await fs.writeFile(path.join(testDir, "docs", "guide.md"), "# Guide\n");
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
});

describe("linked-note enrichment — operator surface (cx inspect --json)", () => {
  test("linked notes appear as section files in the inspect report when includeLinkedNotes is true", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(
      notesDir,
      "20260901120000",
      "Seed",
      "See [[20260901130000]].",
    );
    await writeNote(notesDir, "20260901130000", "LinkedTarget");

    const config = baseConfig(testDir);
    config.manifest.includeLinkedNotes = true;

    const report = await collectInspectReport({ config });

    const allReportedFiles = report.sections.flatMap((s) =>
      s.files.map((f) => f.relativePath),
    );
    expect(allReportedFiles.some((p) => p.includes("20260901130000"))).toBe(
      true,
    );
  });

  test("linked notes are absent from the report when includeLinkedNotes is false", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(
      notesDir,
      "20260902120000",
      "Seed",
      "See [[20260902130000]].",
    );
    await writeNote(notesDir, "20260902130000", "LinkedTarget");

    const config = baseConfig(testDir);
    // includeLinkedNotes defaults to undefined / false — do not set it

    const report = await collectInspectReport({ config });

    const allReportedFiles = report.sections.flatMap((s) =>
      s.files.map((f) => f.relativePath),
    );
    expect(allReportedFiles.some((p) => p.includes("20260902130000"))).toBe(
      false,
    );
  });

  test("linked notes land in the docs section of the inspect report", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(
      notesDir,
      "20260903120000",
      "Seed",
      "See [[20260903130000]].",
    );
    await writeNote(notesDir, "20260903130000", "DocLinkedTarget");

    const config = baseConfig(testDir);
    config.manifest.includeLinkedNotes = true;

    const report = await collectInspectReport({ config });

    const docsSection = report.sections.find((s) => s.name === "docs");
    expect(docsSection).toBeDefined();
    const docsPaths = docsSection?.files.map((f) => f.relativePath) ?? [];
    expect(docsPaths.some((p) => p.includes("20260903130000"))).toBe(true);
  });

  test("injected files in the report have non-zero size and a valid sha256", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(
      notesDir,
      "20260904120000",
      "Seed",
      "See [[20260904130000]].",
    );
    await writeNote(notesDir, "20260904130000", "QualityTarget");

    const config = baseConfig(testDir);
    config.manifest.includeLinkedNotes = true;

    const report = await collectInspectReport({ config });

    const allFiles = report.sections.flatMap((s) => s.files);
    const injected = allFiles.find((f) =>
      f.relativePath.includes("20260904130000"),
    );

    expect(injected).toBeDefined();
    expect(injected?.sizeBytes).toBeGreaterThan(0);
    // absolutePath must be an absolute filesystem path
    expect(path.isAbsolute(injected?.absolutePath ?? "")).toBe(true);
  });

  test("orphan notes are not injected — only notes reachable from a seed", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(
      notesDir,
      "20260905120000",
      "Seed",
      "See [[20260905130000]].",
    );
    await writeNote(notesDir, "20260905130000", "Reachable");
    await writeNote(notesDir, "20260905140000", "Orphan");

    const config = baseConfig(testDir);
    config.manifest.includeLinkedNotes = true;

    const report = await collectInspectReport({ config });

    const allReportedFiles = report.sections.flatMap((s) =>
      s.files.map((f) => f.relativePath),
    );
    expect(allReportedFiles.some((p) => p.includes("20260905130000"))).toBe(
      true,
    );
    expect(allReportedFiles.some((p) => p.includes("20260905140000"))).toBe(
      false,
    );
  });

  test("report summary reflects the additional files from linked-note enrichment", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(
      notesDir,
      "20260906120000",
      "Seed",
      "See [[20260906130000]].",
    );
    await writeNote(notesDir, "20260906130000", "CountedTarget");

    const configOff = baseConfig(testDir);
    const reportOff = await collectInspectReport({ config: configOff });
    const countOff = reportOff.summary.textFileCount;

    const configOn = baseConfig(testDir);
    configOn.manifest.includeLinkedNotes = true;
    const reportOn = await collectInspectReport({ config: configOn });
    const countOn = reportOn.summary.textFileCount;

    // enabling linked-note enrichment must increase the reported file count
    expect(countOn).toBeGreaterThan(countOff);
  });

  test("inspect report exposes inclusion provenance for linked-note enrichment", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(
      notesDir,
      "20260907120000",
      "Seed",
      "See [[20260907130000]].",
    );
    await writeNote(notesDir, "20260907130000", "InspectableTarget");

    const config = baseConfig(testDir);
    config.manifest.includeLinkedNotes = true;

    const report = await collectInspectReport({ config });
    const docsSection = report.sections.find(
      (section) => section.name === "docs",
    );
    const guide = docsSection?.files.find(
      (file) => file.relativePath === "docs/guide.md",
    );
    const injected = docsSection?.files.find((file) =>
      file.relativePath.includes("20260907130000"),
    );

    expect(guide?.provenance).toEqual(["section_match"]);
    expect(injected?.provenance).toEqual([
      "linked_note_enrichment",
      "manifest_note_inclusion",
    ]);
  });
});
