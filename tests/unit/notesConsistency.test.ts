// test-lane: unit

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

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
        expect(report.validationErrors).toHaveLength(0);
        expect(report.brokenLinks).toHaveLength(0);
        expect(report.codePathWarnings).toHaveLength(0);
        expect(report.orphans).toHaveLength(0);
        expect(report.cognition.averageScore).toBe(0);
        expect(report.staleness.averageAgeDays).toBe(0);
        expect(report.trustModel.notes).toBe("conditional");
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
target: current
---

First note content with enough routing words for validation.`,
      );

      await fs.writeFile(
        path.join(notesDir, "note2.md"),
        `---
id: ${noteId}
title: Second Note
target: current
---

Second note content with enough routing words for validation.`,
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
target: current
---

This note has no links but still has enough routing words.`,
      );

      await fs.writeFile(
        path.join(notesDir, "isolated.md"),
        `---
id: 20250113143001
title: Isolated Note
target: current
---

This note also has no links but still has enough routing words.`,
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
target: current
---

Link to [[nonexistent-note]] with enough routing words to validate.`,
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
target: current
---

This is a well-formed note with enough routing words.`,
      );

      try {
        const report = await checkNotesConsistency("notes", tempDir);
        expect(report.totalNotes).toBe(1);
        expect(report.duplicateIds).toHaveLength(0);
        expect(report.brokenLinks).toHaveLength(0);
        expect(report.codePathWarnings).toHaveLength(0);
        expect(report.cognition.averageScore).toBeGreaterThan(0);
        expect(report.staleness.freshCount).toBeGreaterThanOrEqual(0);
        expect(report.trustModel.bundle).toBe("trusted");
      } finally {
        await fs.rm(tempDir, { recursive: true });
      }
    });

    it("surfaces low-signal notes without treating them as structural failure", async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "notes-test-"));
      const notesDir = path.join(tempDir, "notes");
      await fs.mkdir(notesDir, { recursive: true });

      await fs.writeFile(
        path.join(notesDir, "sparse.md"),
        `---
id: 20260413143004
title: Sparse Note
target: current
---

This note remains valid but sparse today.

It intentionally omits structure and supporting links for now.
`,
      );

      try {
        const report = await checkNotesConsistency("notes", tempDir);
        expect(report.valid).toBe(true);
        expect(report.lowSignalNotes).toHaveLength(1);
        expect(report.lowSignalNotes[0]?.title).toBe("Sparse Note");
        expect(report.lowSignalNotes[0]?.label).toBe("low_signal");
        expect(report.lowSignalNotes[0]?.trustLevel).toBe("conditional");
        expect(report.lowSignalNotes[0]?.stalenessLabel).toBe("fresh");
        expect(report.cognition.lowSignalCount).toBe(1);
      } finally {
        await fs.rm(tempDir, { recursive: true });
      }
    });

    it("adds drift pressure to note cognition when code links are stale", async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "notes-test-"));
      const notesDir = path.join(tempDir, "notes");
      await fs.mkdir(notesDir, { recursive: true });

      await fs.writeFile(
        path.join(notesDir, "drifted.md"),
        `---
id: 20260413143005
title: Drifted Note
target: current
---

This note preserves drift guidance for one unstable path.

Track [[src/missing.ts]] before mutation.
`,
      );

      try {
        const report = await checkNotesConsistency("notes", tempDir, {
          now: new Date("2026-04-19T00:00:00Z"),
        });
        expect(report.staleness.driftPressuredCount).toBe(1);
        expect(report.codePathWarnings).toHaveLength(1);
        expect(report.lowSignalNotes[0]?.driftWarningCount).toBe(1);
      } finally {
        await fs.rm(tempDir, { recursive: true });
      }
    });

    it("adds contradiction pressure when notes disagree with code state and each other", async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "notes-test-"));
      const notesDir = path.join(tempDir, "notes");
      const srcDir = path.join(tempDir, "src");
      await fs.mkdir(notesDir, { recursive: true });
      await fs.mkdir(srcDir, { recursive: true });
      await fs.writeFile(
        path.join(srcDir, "shared.ts"),
        "export const value = true;\n",
      );

      await fs.writeFile(
        path.join(notesDir, "positive.md"),
        `---
id: 20260413143006
title: Positive Claim
target: current
---

This note claims a repository path state with enough routing words today.

The file [[src/shared.ts]] is present and active in the repository.
`,
      );
      await fs.writeFile(
        path.join(notesDir, "negative.md"),
        `---
id: 20260413143007
title: Negative Claim
target: current
---

This note claims the opposite path state with enough routing words today.

The file [[src/shared.ts]] is missing and no longer exists.
`,
      );

      try {
        const report = await checkNotesConsistency("notes", tempDir, {
          now: new Date("2026-04-19T00:00:00Z"),
        });
        expect(report.valid).toBe(true);
        expect(report.contradictions.count).toBe(2);
        expect(report.contradictions.siblingConflictCount).toBe(1);
        expect(report.contradictions.codeStateConflictCount).toBe(1);
        expect(
          report.lowSignalNotes.some((note) => note.contradictionCount > 0),
        ).toBe(true);
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
target: current
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
target: current
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
        expect(report.validationErrors).toHaveLength(1);
        expect(report.validationErrors[0]?.error).toContain(
          "Missing required frontmatter field: id",
        );
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
target: current
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
target: current
---

This note documents the notes_list tool behavior for coverage analysis.
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
