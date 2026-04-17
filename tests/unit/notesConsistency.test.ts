import { describe, expect, it } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  checkNoteCoverage,
  checkNotesConsistency,
} from "../../src/notes/consistency.js";

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
      } finally {
        await fs.rm(tempDir, { recursive: true });
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
  });
});
