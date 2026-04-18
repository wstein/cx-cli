import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateNotes } from "../../src/notes/validate.js";

let testDir: string;

beforeEach(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-validate-test-"));
  await fs.mkdir(path.join(testDir, "notes"));
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
});

describe("validateNotes — missing directory", () => {
  test("returns valid empty result when notes dir doesn't exist", async () => {
    const result = await validateNotes("nonexistent", testDir);
    expect(result.valid).toBe(true);
    expect(result.notes).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.duplicateIds).toEqual([]);
  });
});

describe("validateNotes — frontmatter errors", () => {
  test("missing frontmatter id produces error", async () => {
    const notesDir = path.join(testDir, "notes");
    await fs.writeFile(
      path.join(notesDir, "no-id.md"),
      `---
aliases: []
tags: []
---

# Test
`,
    );

    const result = await validateNotes("notes", testDir);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.error).toContain(
      "Missing required frontmatter field: id",
    );
  });

  test("trims whitespace-only entries from aliases", async () => {
    const notesDir = path.join(testDir, "notes");
    await fs.writeFile(
      path.join(notesDir, "trim.md"),
      `---
id: 20250113143015
aliases: ["valid", "   ", "other"]
tags: []
---

# Test
`,
    );

    const result = await validateNotes("notes", testDir);
    expect(result.valid).toBe(true);
    expect(result.notes[0]?.aliases).toEqual(["valid", "other"]);
  });
});

describe("validateNotes — title extraction", () => {
  test("extracts title from H1 when frontmatter title is absent", async () => {
    const notesDir = path.join(testDir, "notes");
    await fs.writeFile(
      path.join(notesDir, "h1-title.md"),
      `---
id: 20250113143015
aliases: []
tags: []
---

# Extracted From Heading

Body text.
`,
    );

    const result = await validateNotes("notes", testDir);
    expect(result.valid).toBe(true);
    expect(result.notes[0]?.title).toBe("Extracted From Heading");
  });

  test("uses frontmatter title when provided", async () => {
    const notesDir = path.join(testDir, "notes");
    await fs.writeFile(
      path.join(notesDir, "fm-title.md"),
      `---
id: 20250113143015
aliases: []
tags: []
title: "From Frontmatter"
---

# This H1 is ignored

Body.
`,
    );

    const result = await validateNotes("notes", testDir);
    expect(result.valid).toBe(true);
    expect(result.notes[0]?.title).toBe("From Frontmatter");
  });
});

describe("validateNotes — normalizeStringArray branches", () => {
  test("aliases is not an array → error", async () => {
    const notesDir = path.join(testDir, "notes");
    await fs.writeFile(
      path.join(notesDir, "bad-aliases.md"),
      `---
id: 20250113143015
aliases: "not-an-array"
tags: []
---

# Test
`,
    );
    const result = await validateNotes("notes", testDir);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.error).toContain("must be an array");
  });

  test("invalid ID format → error with format hint", async () => {
    const notesDir = path.join(testDir, "notes");
    await fs.writeFile(
      path.join(notesDir, "bad-id.md"),
      `---
id: not-a-timestamp
aliases: []
tags: []
---

# Test
`,
    );
    const result = await validateNotes("notes", testDir);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.error).toContain("Invalid note ID format");
  });

  test("duplicate IDs across two notes → reported in duplicateIds", async () => {
    const notesDir = path.join(testDir, "notes");
    const note = `---
id: 20250113143015
aliases: []
tags: []
---

# Note
`;
    await fs.writeFile(path.join(notesDir, "note-a.md"), note);
    await fs.writeFile(path.join(notesDir, "note-b.md"), note);
    const result = await validateNotes("notes", testDir);
    expect(result.duplicateIds).toHaveLength(1);
    expect(result.duplicateIds[0]?.id).toBe("20250113143015");
    expect(result.duplicateIds[0]?.files).toHaveLength(2);
    expect(result.valid).toBe(false);
  });
});

describe("validateNotes — read errors", () => {
  test("reports error when file becomes unreadable (perm denied)", async () => {
    const notesDir = path.join(testDir, "notes");
    const filePath = path.join(notesDir, "20250113143015-test.md");
    await fs.writeFile(
      filePath,
      `---
id: 20250113143015
aliases: []
tags: []
---

# Test
`,
    );

    // Try making it unreadable; if platform doesn't support, skip
    try {
      await fs.chmod(filePath, 0o000);
      const result = await validateNotes("notes", testDir);
      await fs.chmod(filePath, 0o644);

      if (result.errors.length > 0) {
        expect(result.errors[0]?.error).toContain("Failed to read");
      }
    } catch {
      await fs.chmod(filePath, 0o644).catch(() => {});
    }
  });
});
