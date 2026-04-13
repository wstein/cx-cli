import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { runNotesCommand, createNewNote, listNotes } from "../../src/cli/commands/notes.js";
import { buildNoteGraph, getBacklinks } from "../../src/notes/graph.js";
import { validateNotes } from "../../src/notes/validate.js";

let testDir: string;

beforeEach(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-notes-test-"));
  await fs.mkdir(path.join(testDir, "notes"));
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
});

describe("Notes Validation", () => {
  test("validates valid note IDs", async () => {
    const notesDir = path.join(testDir, "notes");
    const noteContent = `---
id: 202501131430
aliases: []
tags: []
---

# Test Note

This is a valid note.
`;

    await fs.writeFile(path.join(notesDir, "202501131430-test.md"), noteContent);

    const result = await validateNotes("notes", testDir);
    expect(result.valid).toBe(true);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]?.id).toBe("202501131430");
    expect(result.errors).toHaveLength(0);
  });

  test("derives title from filename when frontmatter and H1 are absent", async () => {
    const notesDir = path.join(testDir, "notes");

    await fs.writeFile(
      path.join(notesDir, "202604131201-vcs-master-base.md"),
      `---
id: 202604131201
aliases: []
tags: []
---

Plain body only.
`,
    );

    const result = await validateNotes("notes", testDir);
    expect(result.valid).toBe(true);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]?.title).toBe("vcs-master-base");
  });

  test("rejects malformed note IDs", async () => {
    const notesDir = path.join(testDir, "notes");
    const noteContent = `---
id: invalid-id
aliases: []
tags: []
---

# Test Note

This note has an invalid ID.
`;

    await fs.writeFile(path.join(notesDir, "test-invalid.md"), noteContent);

    const result = await validateNotes("notes", testDir);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.error).toContain("Invalid note ID format");
  });

  test("detects duplicate note IDs", async () => {
    const notesDir = path.join(testDir, "notes");
    const noteContent = `---
id: 202501131430
aliases: []
tags: []
---

# Test Note

Duplicate ID.
`;

    await fs.writeFile(path.join(notesDir, "note-1.md"), noteContent);
    await fs.writeFile(path.join(notesDir, "note-2.md"), noteContent);

    const result = await validateNotes("notes", testDir);
    expect(result.valid).toBe(false);
    expect(result.duplicateIds).toHaveLength(1);
    expect(result.duplicateIds[0]?.id).toBe("202501131430");
    expect(result.duplicateIds[0]?.files).toHaveLength(2);
  });

  test("validates date components in note IDs", async () => {
    const notesDir = path.join(testDir, "notes");
    const invalidIds = ["202513131430", "202501321430", "202501132560", "202501131360"];

    for (const id of invalidIds) {
      const noteContent = `---
id: ${id}
aliases: []
tags: []
---

# Test Note
`;
      await fs.writeFile(path.join(notesDir, `${id}.md`), noteContent);
    }

    const result = await validateNotes("notes", testDir);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("Notes Commands", () => {
  test("creates a new note with auto-generated ID", async () => {
    const origCwd = process.cwd();
    process.chdir(testDir);

    try {
      const { id, filePath } = await createNewNote("Test Note", {
        tags: ["test", "demo"],
      });

      expect(id).toMatch(/^\d{12}$/);
      expect(filePath).toContain("test-note");
      expect(filePath).toContain(".md");

      const content = await fs.readFile(filePath, "utf-8");
      expect(content).toContain(`id: ${id}`);
      expect(content).not.toContain("title: Test Note");
      expect(content).toContain("Write your note here.");
      expect(content).toContain("test");
      expect(content).toContain("demo");
    } finally {
      process.chdir(origCwd);
    }
  });

  test("lists all notes", async () => {
    const origCwd = process.cwd();
    process.chdir(testDir);

    try {
      await createNewNote("Note 1", { tags: ["tag1"] });
      await createNewNote("Note 2", { tags: ["tag2"] });

      const notes = await listNotes("notes");
      expect(notes.length).toBeGreaterThanOrEqual(2);
      expect(notes.some((note) => note.title === "Note 1")).toBe(true);
      expect(notes.some((note) => note.title === "Note 2")).toBe(true);
    } finally {
      process.chdir(origCwd);
    }
  });

  test("new command throws if title is missing", async () => {
    const origCwd = process.cwd();
    process.chdir(testDir);

    try {
      await expect(runNotesCommand({ subcommand: "new" })).rejects.toThrow(
        "--title is required",
      );
    } finally {
      process.chdir(origCwd);
    }
  });
});

describe("Notes Graph", () => {
  test("builds a note graph with wikilinks", async () => {
    const origCwd = process.cwd();
    process.chdir(testDir);

    try {
      const note1 = await createNewNote("First Note");
      const note2 = await createNewNote("Second Note");

      const note1Path = note1.filePath;
      let content = await fs.readFile(note1Path, "utf-8");
      content += `\n\nSee also: [[${note2.id}]]\n`;
      await fs.writeFile(note1Path, content);

      const graph = await buildNoteGraph("notes", testDir, false);
      expect(graph.notes.size).toBeGreaterThan(0);
      expect(graph.links.length).toBeGreaterThan(0);
    } finally {
      process.chdir(origCwd);
    }
  });

  test("detects orphan notes", async () => {
    const origCwd = process.cwd();
    process.chdir(testDir);

    try {
      const orphan1 = await createNewNote("Orphan 1");
      await createNewNote("Orphan 2");

      const graph = await buildNoteGraph("notes", testDir, false);
      expect(graph.orphans.length).toBeGreaterThan(0);
      expect(graph.orphans).toContain(orphan1.id);
    } finally {
      process.chdir(origCwd);
    }
  });

  test("getBacklinks returns notes linking to a target", async () => {
    const origCwd = process.cwd();
    process.chdir(testDir);

    try {
      const target = await createNewNote("Target Note");
      const source1 = await createNewNote("Source 1");

      const sourcePath = source1.filePath;
      let content = await fs.readFile(sourcePath, "utf-8");
      content += `\n\nLinks to: [[${target.id}]]\n`;
      await fs.writeFile(sourcePath, content);

      const graph = await buildNoteGraph("notes", testDir, false);
      const backlinks = getBacklinks(graph, target.id);
      expect(backlinks.length).toBeGreaterThan(0);
    } finally {
      process.chdir(origCwd);
    }
  });
});

describe("Notes Command Subcommands", () => {
  test("list subcommand returns all notes", async () => {
    const origCwd = process.cwd();
    process.chdir(testDir);

    try {
      await createNewNote("Note A");
      await createNewNote("Note B");

      const notes = await listNotes("notes");
      expect(notes.length).toBeGreaterThanOrEqual(2);
    } finally {
      process.chdir(origCwd);
    }
  });

  test("new subcommand creates a note with title and tags", async () => {
    const origCwd = process.cwd();
    process.chdir(testDir);

    try {
      const { id } = await createNewNote("My New Note", {
        tags: ["important", "architecture"],
      });

      const notes = await listNotes("notes");
      const created = notes.find((note) => note.id === id);

      expect(created).toBeDefined();
      expect(created?.title).toBe("My New Note");
      expect(created?.tags).toContain("important");
      expect(created?.tags).toContain("architecture");
    } finally {
      process.chdir(origCwd);
    }
  });

  test("orphans subcommand identifies unlinked notes", async () => {
    const origCwd = process.cwd();
    process.chdir(testDir);

    try {
      const orphan = await createNewNote("Isolated Note");
      const graph = await buildNoteGraph("notes", testDir, false);

      expect(graph.orphans).toContain(orphan.id);
    } finally {
      process.chdir(origCwd);
    }
  });
});
