// test-lane: integration

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { validateNotes } from "../../src/notes/validate.js";
import { sha256File, sha256Text } from "../../src/shared/hashing.js";

let rootDir = "";

beforeEach(async () => {
  rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-edge-integration-"));
  await fs.mkdir(path.join(rootDir, "notes"), { recursive: true });
});

afterEach(async () => {
  await fs.rm(rootDir, { recursive: true, force: true });
});

describe("integration edge cases", () => {
  test("sha256File matches sha256Text for UTF-8 files in deep paths", async () => {
    const deepDir = path.join(rootDir, "a", "b", "c", "d", "e", "f", "g", "h");
    await fs.mkdir(deepDir, { recursive: true });

    const filePath = path.join(deepDir, "unicode-note.md");
    const content = "line1\r\nline2\nemoji 🎉 and 中文 text\rline4";
    await fs.writeFile(filePath, content, "utf8");

    const fromFile = await sha256File(filePath);
    const fromText = sha256Text(content);
    expect(fromFile).toBe(fromText);
  });

  test("validateNotes ignores nested templates and still validates regular note files", async () => {
    const notesDir = path.join(rootDir, "notes");
    const templatesDir = path.join(notesDir, "Templates");
    await fs.mkdir(templatesDir, { recursive: true });

    await fs.writeFile(
      path.join(templatesDir, "Atomic Note Template.md"),
      `---
id: YYYYMMDDHHMMSS
aliases: []
tags: []
status: current
---
`,
      "utf8",
    );

    await fs.writeFile(
      path.join(notesDir, "20260419120000-regular-note.md"),
      `---
id: 20260419120000
aliases: []
tags: []
status: current
---

# Regular Note

This note should be validated normally.
`,
      "utf8",
    );

    const result = await validateNotes("notes", rootDir);
    expect(result.valid).toBe(true);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]?.id).toBe("20260419120000");
  });
});
