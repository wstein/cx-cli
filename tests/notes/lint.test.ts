// test-lane: integration

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import type { CxSectionConfig } from "../../src/config/types.js";
import {
  applyLintFixes,
  detectGitFollowRenames,
  lintNotes,
  readLintHistory,
} from "../../src/notes/lint.js";
import { parseMarkdownFrontmatter } from "../../src/notes/parser.js";

let root: string;
let notesDir: string;
const execFileAsync = promisify(execFile);

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
    expect(history[0]?.changeKind).toBe(
      "frontmatter.path_tags,frontmatter.updated_at",
    );
  });

  test("auto-fixes renamed frontmatter anchors when git-follow confidence is high", async () => {
    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.writeFile(path.join(root, "src", "new.ts"), "", "utf8");
    const notePath = await writeNote(
      "claim.md",
      `---
id: 20250113143002
title: Claim Note
claims:
  - id: rename-anchor
    type: fact
    status: accepted
    code_refs: ["src/old.ts"]
    test_refs: []
    doc_refs: []
---

Body content stays byte identical with enough routing words for validation.`,
    );
    const before = await fs.readFile(notePath, "utf8");
    const result = await lintNotes("notes", root, {
      renameDetector: async () => [
        {
          oldPath: "src/old.ts",
          newPath: "src/new.ts",
          score: 1,
          commit: "abc123",
        },
      ],
    });

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        category: "missing",
        targetPath: "src/old.ts",
        replacementPath: "src/new.ts",
        confidence: 0.95,
        autoFixable: true,
      }),
    );

    await applyLintFixes(result.findings, {
      projectRoot: root,
      notesDir,
    });

    const after = await fs.readFile(notePath, "utf8");
    const afterParsed = parseMarkdownFrontmatter(after);
    expect(sha256(afterParsed.body)).toBe(
      sha256(parseMarkdownFrontmatter(before).body),
    );
    expect(after).toContain('code_refs: ["src/new.ts"]');
    expect(after).not.toContain("src/old.ts");
    const history = await readLintHistory(notesDir);
    expect(history[0]?.changeKind).toBe("frontmatter.structural_anchor");
  });

  test("detects git rename candidates from recent follow history", async () => {
    await execFileAsync("git", ["init"], { cwd: root });
    await execFileAsync("git", ["config", "user.email", "cx@example.test"], {
      cwd: root,
    });
    await execFileAsync("git", ["config", "user.name", "CX Tests"], {
      cwd: root,
    });
    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.writeFile(path.join(root, "src", "old.ts"), "export {}\n", "utf8");
    await execFileAsync("git", ["add", "src/old.ts"], { cwd: root });
    await execFileAsync("git", ["commit", "-m", "add old"], { cwd: root });
    await execFileAsync("git", ["mv", "src/old.ts", "src/new.ts"], {
      cwd: root,
    });
    await execFileAsync("git", ["commit", "-m", "rename old"], { cwd: root });

    const candidates = await detectGitFollowRenames("src/old.ts", root);

    expect(candidates).toContainEqual(
      expect.objectContaining({
        oldPath: "src/old.ts",
        newPath: "src/new.ts",
      }),
    );
  });
});
