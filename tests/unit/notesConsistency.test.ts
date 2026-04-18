// test-lane: unit
import { describe, expect, it } from "bun:test";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import {
  checkNoteCoverage,
  checkNotesConsistency,
} from "../../src/notes/consistency.js";

const execFileAsync = promisify(execFile);

describe("Notes Consistency Check", () => {
  describe("checkNotesConsistency", () => {
    it("returns valid when notes directory is empty", async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "notes-test-"));
      const notesDir = path.join(tempDir, "notes");
      await fs.mkdir(notesDir, { recursive: true });

      try {
        const report = await checkNotesConsistency("notes", tempDir);
        expect(report.valid).toBe(true);
        expect(report.totalNotes).toBe(0);
        expect(report.duplicateIds).toHaveLength(0);
        expect(report.brokenLinks).toHaveLength(0);
        expect(report.codePathWarnings).toHaveLength(0);
        expect(report.orphans).toHaveLength(0);
      } finally {
        await fs.rm(tempDir, { recursive: true });
      }
    });

    it("detects duplicate note IDs", async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "notes-test-"));
      const notesDir = path.join(tempDir, "notes");
      await fs.mkdir(notesDir, { recursive: true });

      const noteId = "20250113143000";
      await fs.writeFile(
        path.join(notesDir, "note1.md"),
        `---
id: ${noteId}
title: First Note
---

First note content`,
      );

      await fs.writeFile(
        path.join(notesDir, "note2.md"),
        `---
id: ${noteId}
title: Second Note
---

Second note content`,
      );

      try {
        const report = await checkNotesConsistency("notes", tempDir);
        expect(report.valid).toBe(false);
        expect(report.duplicateIds).toHaveLength(1);
        const dup = report.duplicateIds[0];
        expect(dup).toBeDefined();
        expect(dup?.id).toBe(noteId);
        expect(dup?.files).toHaveLength(2);
      } finally {
        await fs.rm(tempDir, { recursive: true });
      }
    });

    it("detects orphan notes", async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "notes-test-"));
      const notesDir = path.join(tempDir, "notes");
      await fs.mkdir(notesDir, { recursive: true });

      await fs.writeFile(
        path.join(notesDir, "orphan.md"),
        `---
id: 20250113143000
title: Orphan Note
---

This note has no links`,
      );

      await fs.writeFile(
        path.join(notesDir, "isolated.md"),
        `---
id: 20250113143001
title: Isolated Note
---

This note also has no links`,
      );

      try {
        const report = await checkNotesConsistency("notes", tempDir);
        expect(report.orphans.length).toBeGreaterThanOrEqual(2);
        const orphanIds = report.orphans.map((o) => o.id);
        expect(orphanIds).toContain("20250113143000");
        expect(orphanIds).toContain("20250113143001");
      } finally {
        await fs.rm(tempDir, { recursive: true });
      }
    });

    it("detects broken internal links", async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "notes-test-"));
      const notesDir = path.join(tempDir, "notes");
      await fs.mkdir(notesDir, { recursive: true });

      await fs.writeFile(
        path.join(notesDir, "broken.md"),
        `---
id: 20250113143000
title: Broken Links
---

Link to [[nonexistent-note]]`,
      );

      try {
        const report = await checkNotesConsistency("notes", tempDir);
        expect(report.valid).toBe(false);
        expect(report.brokenLinks.length).toBeGreaterThan(0);
        const brokenLink = report.brokenLinks[0];
        expect(brokenLink).toBeDefined();
        expect(brokenLink?.fromNoteId).toBe("20250113143000");
        expect(brokenLink?.source).toBe("note");
      } finally {
        await fs.rm(tempDir, { recursive: true });
      }
    });

    it("reports valid when all notes are well-formed and no errors", async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "notes-test-"));
      const notesDir = path.join(tempDir, "notes");
      await fs.mkdir(notesDir, { recursive: true });

      await fs.writeFile(
        path.join(notesDir, "note1.md"),
        `---
id: 20250113143000
title: First Note
---

This is a well-formed note`,
      );

      try {
        const report = await checkNotesConsistency("notes", tempDir);
        expect(report.totalNotes).toBe(1);
        expect(report.duplicateIds).toHaveLength(0);
        expect(report.brokenLinks).toHaveLength(0);
        expect(report.codePathWarnings).toHaveLength(0);
      } finally {
        await fs.rm(tempDir, { recursive: true });
      }
    });

    it("warns when notes reference code paths missing from the repository", async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "notes-test-"));
      const notesDir = path.join(tempDir, "notes");
      await fs.mkdir(notesDir, { recursive: true });

      await fs.writeFile(
        path.join(notesDir, "drift.md"),
        `---
id: 20250113143002
title: Drift Warning
---

See [[src/missing.ts]] for the implementation details.`,
      );

      try {
        const report = await checkNotesConsistency("notes", tempDir);
        expect(report.valid).toBe(true);
        expect(report.codePathWarnings).toHaveLength(1);
        expect(report.codePathWarnings[0]?.path).toBe("src/missing.ts");
        expect(report.codePathWarnings[0]?.status).toBe("missing");
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it("warns when notes reference code paths outside the VCS master list", async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "notes-test-"));
      const notesDir = path.join(tempDir, "notes");
      const srcDir = path.join(tempDir, "src");
      await fs.mkdir(notesDir, { recursive: true });
      await fs.mkdir(srcDir, { recursive: true });

      await fs.writeFile(
        path.join(notesDir, "untracked.md"),
        `---
id: 20250113143003
title: Untracked Code Path
---

See [[src/generated.ts]] before changing the generator.`,
      );
      await fs.writeFile(
        path.join(srcDir, "generated.ts"),
        "export const generated = true;\n",
      );
      await execFileAsync("git", ["init", "-q"], { cwd: tempDir });
      await execFileAsync("git", ["config", "user.email", "cx@example.com"], {
        cwd: tempDir,
      });
      await execFileAsync("git", ["config", "user.name", "cx"], {
        cwd: tempDir,
      });
      await execFileAsync("git", ["add", "notes"], { cwd: tempDir });
      await execFileAsync("git", ["commit", "-q", "-m", "init"], {
        cwd: tempDir,
      });

      try {
        const report = await checkNotesConsistency("notes", tempDir);
        expect(report.valid).toBe(true);
        expect(report.codePathWarnings).toHaveLength(1);
        expect(report.codePathWarnings[0]?.path).toBe("src/generated.ts");
        expect(report.codePathWarnings[0]?.status).toBe("outside_master_list");
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it("handles notes without frontmatter gracefully", async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "notes-test-"));
      const notesDir = path.join(tempDir, "notes");
      await fs.mkdir(notesDir, { recursive: true });

      await fs.writeFile(
        path.join(notesDir, "bad.md"),
        `No frontmatter here, just content`,
      );

      try {
        const report = await checkNotesConsistency("notes", tempDir);
        expect(report.valid).toBe(false);
        expect(report.totalNotes).toBe(0);
      } finally {
        await fs.rm(tempDir, { recursive: true });
      }
    });
  });

  describe("checkNoteCoverage", () => {
    it("returns coverage report for documented tools", async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "notes-test-"));
      const notesDir = path.join(tempDir, "notes");
      await fs.mkdir(notesDir, { recursive: true });

      await fs.writeFile(
        path.join(notesDir, "tools.md"),
        `---
id: 20250113143000
title: Tools
---

Documentation for tools`,
      );

      try {
        const report = await checkNoteCoverage("notes", tempDir);
        expect(report.totalTools).toBeGreaterThan(0);
        expect(report.documentedTools).toBeGreaterThanOrEqual(0);
        expect(report.percentage).toBeGreaterThanOrEqual(0);
        expect(report.percentage).toBeLessThanOrEqual(100);
      } finally {
        await fs.rm(tempDir, { recursive: true });
      }
    });

    it("counts tool as documented when a code file named after it references the note", async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "notes-test-"));
      const notesDir = path.join(tempDir, "notes");
      const srcDir = path.join(tempDir, "src");
      await fs.mkdir(notesDir, { recursive: true });
      await fs.mkdir(srcDir, { recursive: true });

      await fs.writeFile(
        path.join(notesDir, "20250113143000-notes_list.md"),
        `---
id: 20250113143000
aliases: []
tags: []
---

# notes_list
`,
      );

      // File named after a known tool that contains a reference to the note
      await fs.writeFile(
        path.join(srcDir, "notes_list.ts"),
        `// See [[20250113143000]] for documentation\nexport const x = 1;\n`,
      );

      try {
        const report = await checkNoteCoverage("notes", tempDir);
        expect(report.totalTools).toBeGreaterThan(0);
        expect(report.documentedTools).toBeGreaterThan(0);
        expect(report.undocumentedTools).not.toContain("notes_list");
      } finally {
        await fs.rm(tempDir, { recursive: true });
      }
    });
  });
});
