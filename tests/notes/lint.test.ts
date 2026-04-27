// test-lane: integration

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import type { CxSectionConfig } from "../../src/config/types.js";
import {
  applyLintFixes,
  lintNotes,
  readLintHistory,
} from "../../src/notes/lint.js";
import { parseMarkdownFrontmatter } from "../../src/notes/parser.js";

let root: string;
let notesDir: string;

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function writeNote(fileName: string, body: string) {
  const filePath = path.join(notesDir, fileName);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, body, "utf8");
  return filePath;
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-notes-lint-"));
  notesDir = path.join(root, "notes");
  await fs.mkdir(notesDir, { recursive: true });
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("notes lint", () => {
  test("reports missing, outside_master_list, and excluded_from_plan drift", async () => {
    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.writeFile(path.join(root, "src", "untracked.ts"), "", "utf8");
    await fs.writeFile(path.join(root, "src", "tracked.ts"), "", "utf8");
    await writeNote(
      "drift.md",
      `---
id: 20250113143000
title: Drift Note
---

This note references [[src/missing.ts]], [[src/untracked.ts]], and [[src/tracked.ts]] with enough routing words.`,
    );
    const sections = new Map<string, CxSectionConfig>([
      [
        "docs",
        {
          include: ["docs/**"],
          exclude: [],
          priority: 0,
        },
      ],
    ]);

    const result = await lintNotes("notes", root, {
      repositoryPaths: ["src/tracked.ts"],
      sectionEntries: sections,
    });

    expect(result.findings.map((finding) => finding.category).sort()).toEqual([
      "excluded_from_plan",
      "missing",
      "outside_master_list",
    ]);
  });

  test("write mode rewrites frontmatter only and appends audit history", async () => {
    const notePath = await writeNote(
      path.join("area", "structural.md"),
      `---
id: 20250113143001
title: Structural Note
tags: ["existing"]
updated_at: "2020-01-01"
---

Body content stays byte identical with enough routing words for validation.`,
    );
    const before = await fs.readFile(notePath, "utf8");
    const beforeBody = parseMarkdownFrontmatter(before).body;
    const result = await lintNotes("notes", root);
    expect(
      result.findings.filter((finding) => finding.autoFixable),
    ).toHaveLength(2);

    const writeResult = await applyLintFixes(result.findings, {
      projectRoot: root,
      notesDir,
      yes: true,
    });

    const after = await fs.readFile(notePath, "utf8");
    const afterParsed = parseMarkdownFrontmatter(after);
    expect(writeResult.applied).toBe(2);
    expect(sha256(afterParsed.body)).toBe(sha256(beforeBody));
    expect(afterParsed.frontmatter.tags).toEqual(["existing", "area"]);
    expect(afterParsed.frontmatter.updated_at).not.toBe("2020-01-01");

    const history = await readLintHistory(notesDir);
    expect(history).toHaveLength(1);
    expect(history[0]?.noteId).toBe("20250113143001");
  });
});
