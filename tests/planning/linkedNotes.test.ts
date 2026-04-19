// test-lane: integration
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DEFAULT_BEHAVIOR_VALUES } from "../../src/config/defaults.js";
import type { CxConfig } from "../../src/config/types.js";
import { enrichPlanWithLinkedNotes } from "../../src/notes/planner.js";
import { buildBundlePlan } from "../../src/planning/buildPlan.js";

let testDir: string;

const writeNote = async (
  notesDir: string,
  id: string,
  title: string,
  body = "",
): Promise<void> => {
  const noteBody = body.length > 0 ? body : `${title} summary.`;
  const content = `---
id: ${id}
aliases: []
tags: []
---

# ${title}

${noteBody}
`;
  await fs.writeFile(path.join(notesDir, `${id}-${title}.md`), content);
};

function baseConfig(root: string): CxConfig {
  return {
    schemaVersion: 1,
    projectName: "demo",
    sourceRoot: root,
    outputDir: path.join(root, "dist", "demo-bundle"),
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
    },
    manifest: {
      format: "json",
      pretty: true,
      includeFileSha256: true,
      includeOutputSha256: true,
      includeOutputSpans: true,
      includeSourceMetadata: true,
    },
    checksums: {
      algorithm: "sha256",
      fileName: "demo.sha256",
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
      targetDir: "demo-assets",
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
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-linked-notes-"));
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

describe("enrichPlanWithLinkedNotes", () => {
  test("returns plan unchanged when includeLinkedNotes is false or absent", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(notesDir, "20260101120000", "A", "See [[20260101130000]].");
    await writeNote(notesDir, "20260101130000", "B");

    const config = baseConfig(testDir);
    const plan = await buildBundlePlan(config);
    const before = plan.sections.map((s) => s.files.map((f) => f.relativePath));

    await enrichPlanWithLinkedNotes(plan, config);
    const after = plan.sections.map((s) => s.files.map((f) => f.relativePath));

    expect(after).toEqual(before);
  });

  test("injects linked notes into the docs section when it exists", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(
      notesDir,
      "20260101120000",
      "Source",
      "See [[20260101130000]].",
    );
    await writeNote(notesDir, "20260101130000", "Target");

    const config = baseConfig(testDir);
    config.manifest.includeLinkedNotes = true;

    const plan = await buildBundlePlan(config);
    await enrichPlanWithLinkedNotes(plan, config);

    const docs = plan.sections.find((s) => s.name === "docs");
    const addedPaths = docs?.files.map((f) => f.relativePath) ?? [];
    expect(addedPaths.some((p) => p.includes("20260101130000"))).toBe(true);
  });

  test("falls back to the first section when no docs section exists", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(
      notesDir,
      "20260201120000",
      "Source",
      "See [[20260201130000]].",
    );
    await writeNote(notesDir, "20260201130000", "Target");

    const config = baseConfig(testDir);
    config.manifest.includeLinkedNotes = true;
    config.sections = {
      src: { include: ["src/**"], exclude: [] },
    };

    const plan = await buildBundlePlan(config);
    await enrichPlanWithLinkedNotes(plan, config);

    const src = plan.sections.find((s) => s.name === "src");
    const addedPaths = src?.files.map((f) => f.relativePath) ?? [];
    expect(addedPaths.some((p) => p.includes("20260201130000"))).toBe(true);
  });

  test("does not inject notes already claimed by a section", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(
      notesDir,
      "20260301120000",
      "Source",
      "See [[20260301130000]].",
    );
    await writeNote(notesDir, "20260301130000", "Target");

    const config = baseConfig(testDir);
    config.manifest.includeLinkedNotes = true;
    const targetRelPath = `notes/20260301130000-Target.md`;
    config.sections = {
      docs: { include: ["docs/**", targetRelPath], exclude: [] },
      src: { include: ["src/**"], exclude: [] },
    };

    const plan = await buildBundlePlan(config);
    const docsCountBefore =
      plan.sections.find((s) => s.name === "docs")?.files.length ?? 0;

    await enrichPlanWithLinkedNotes(plan, config);
    const docsCountAfter =
      plan.sections.find((s) => s.name === "docs")?.files.length ?? 0;

    expect(docsCountAfter).toBe(docsCountBefore);
  });

  test("only injects notes that have at least one incoming link", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(notesDir, "20260401120000", "Linked", "");
    await writeNote(
      notesDir,
      "20260401130000",
      "Source",
      "See [[20260401120000]].",
    );
    await writeNote(notesDir, "20260401140000", "Orphan");

    const config = baseConfig(testDir);
    config.manifest.includeLinkedNotes = true;

    const plan = await buildBundlePlan(config);
    await enrichPlanWithLinkedNotes(plan, config);

    const allInjected = plan.sections.flatMap((s) =>
      s.files.map((f) => f.relativePath),
    );
    expect(allInjected.some((p) => p.includes("20260401120000"))).toBe(true);
    expect(allInjected.some((p) => p.includes("20260401140000"))).toBe(false);
  });

  test("result is deterministically sorted within the target section", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(
      notesDir,
      "20260501120000",
      "Root",
      "See [[20260501140000]] and [[20260501130000]].",
    );
    await writeNote(notesDir, "20260501130000", "Bravo");
    await writeNote(notesDir, "20260501140000", "Alpha");

    const config = baseConfig(testDir);
    config.manifest.includeLinkedNotes = true;

    const plan = await buildBundlePlan(config);
    await enrichPlanWithLinkedNotes(plan, config);

    const docs = plan.sections.find((s) => s.name === "docs");
    const paths = docs?.files.map((f) => f.relativePath) ?? [];
    const injectedPaths = paths.filter((p) => p.startsWith("notes/"));
    expect(injectedPaths).toEqual([...injectedPaths].sort());
  });

  test("returns plan unchanged when there are no sections", async () => {
    const config = baseConfig(testDir);
    config.manifest.includeLinkedNotes = true;
    config.sections = {};

    const plan = await buildBundlePlan(config);
    const result = await enrichPlanWithLinkedNotes(plan, config);

    expect(result).toBe(plan);
  });

  test("injected notes have correct PlannedSourceFile fields", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(
      notesDir,
      "20260601120000",
      "Source",
      "See [[20260601130000]].",
    );
    await writeNote(notesDir, "20260601130000", "Target");

    const config = baseConfig(testDir);
    config.manifest.includeLinkedNotes = true;

    const plan = await buildBundlePlan(config);
    await enrichPlanWithLinkedNotes(plan, config);

    const docs = plan.sections.find((s) => s.name === "docs");
    const injected = docs?.files.find((f) =>
      f.relativePath.includes("20260601130000"),
    );

    expect(injected).toBeDefined();
    expect(injected?.kind).toBe("text");
    expect(injected?.sizeBytes).toBeGreaterThan(0);
    expect(injected?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(injected?.mtime).toBeTruthy();
    expect(injected?.provenance).toEqual([
      "linked_note_enrichment",
      "manifest_note_inclusion",
    ]);
  });

  test("section-owned files retain section_match provenance", async () => {
    const config = baseConfig(testDir);

    const plan = await buildBundlePlan(config);
    const docs = plan.sections.find((section) => section.name === "docs");
    const guide = docs?.files.find(
      (file) => file.relativePath === "docs/guide.md",
    );

    expect(guide?.provenance).toEqual(["section_match"]);
  });
});
