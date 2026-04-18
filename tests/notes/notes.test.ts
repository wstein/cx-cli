import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runNotesCommand } from "../../src/cli/commands/notes.js";
import {
  createNewNote,
  deleteNote,
  listNotes,
  readNote,
  renameNote,
  searchNotes,
  updateNote,
} from "../../src/notes/crud.js";
import {
  buildNoteGraph,
  getBacklinks,
  getBrokenLinks,
} from "../../src/notes/graph.js";
import { validateNotes } from "../../src/notes/validate.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";

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
id: 20250113143015
aliases: []
tags: []
---

# Test Note

This is a valid note.
`;

    await fs.writeFile(
      path.join(notesDir, "20250113143015-test.md"),
      noteContent,
    );

    const result = await validateNotes("notes", testDir);
    expect(result.valid).toBe(true);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]?.id).toBe("20250113143015");
    expect(result.errors).toHaveLength(0);
  });

  test("ignores template files in nested note directories", async () => {
    const notesDir = path.join(testDir, "notes");
    const nestedDir = path.join(notesDir, "Templates");
    await fs.mkdir(nestedDir, { recursive: true });

    await fs.writeFile(
      path.join(nestedDir, "Atomic Note Template.md"),
      `---
id: YYYYMMDDHHMMSS
aliases: []
tags: []
---

Template note content.
`,
    );

    const result = await validateNotes("notes", testDir);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("derives title from filename when frontmatter and H1 are absent", async () => {
    const notesDir = path.join(testDir, "notes");

    await fs.writeFile(
      path.join(notesDir, "20260413120130-vcs-master-base.md"),
      `---
id: 20260413120130
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

  test("extracts note summaries from the body", async () => {
    const notesDir = path.join(testDir, "notes");

    await fs.writeFile(
      path.join(notesDir, "summary-note.md"),
      `---
id: 20260413123030
aliases: []
tags: []
---

# Summary Note

This note explains the first useful idea.
It should become the manifest summary.

## Links

- [[Other Note]] - related idea
`,
    );

    const result = await validateNotes("notes", testDir);
    expect(result.valid).toBe(true);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]?.summary).toBe(
      "This note explains the first useful idea. It should become the manifest summary.",
    );
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

  test("rejects non-array aliases and tags", async () => {
    const notesDir = path.join(testDir, "notes");
    const noteContent = `---
id: 20250113143015
aliases: demo
tags: demo
---

# Test Note
`;

    await fs.writeFile(
      path.join(notesDir, "note-invalid-frontmatter.md"),
      noteContent,
    );

    const result = await validateNotes("notes", testDir);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.error).toContain("aliases");
  });

  test("detects duplicate note IDs", async () => {
    const notesDir = path.join(testDir, "notes");
    const noteContent = `---
id: 20250113143015
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
    expect(result.duplicateIds[0]?.id).toBe("20250113143015");
    expect(result.duplicateIds[0]?.files).toHaveLength(2);
  });

  test("validates date components in note IDs", async () => {
    const notesDir = path.join(testDir, "notes");
    const invalidIds = [
      "20251313143015",
      "20250132143015",
      "20250113256015",
      "20250113136015",
      "20250113143060",
    ];

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

      expect(id).toMatch(/^\d{14}$/);
      expect(filePath).toContain("Test Note");
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

  test("creates a new note with an initial body", async () => {
    const origCwd = process.cwd();
    process.chdir(testDir);

    try {
      const { filePath } = await createNewNote("Body Note", {
        body: "This note starts with a concrete summary.",
      });

      const content = await fs.readFile(filePath, "utf-8");
      expect(content).toContain("This note starts with a concrete summary.");
      expect(content).toContain("## Links");
      expect(content).not.toContain("Write your note here.");
    } finally {
      process.chdir(origCwd);
    }
  });

  test("updates an existing note body and tags", async () => {
    const origCwd = process.cwd();
    process.chdir(testDir);

    try {
      const created = await createNewNote("Update Note", {
        body: "Original body.",
        tags: ["old"],
      });

      const updated = await updateNote(created.id, {
        body: "Revised body.",
        tags: ["new", "better"],
      });

      expect(updated.tags).toEqual(["new", "better"]);

      const content = await fs.readFile(updated.filePath, "utf8");
      expect(content).toContain("Revised body.");
      expect(content).toContain("new");
      expect(content).not.toContain("Original body.");
    } finally {
      process.chdir(origCwd);
    }
  });

  test("renames an existing note without changing its id", async () => {
    const origCwd = process.cwd();
    process.chdir(testDir);

    try {
      const created = await createNewNote("Old Title", {
        body: "Rename me.",
      });

      const renamed = await renameNote(created.id, "New Title");

      expect(renamed.id).toBe(created.id);
      expect(renamed.title).toBe("New Title");
      expect(path.basename(renamed.filePath)).toContain("New Title");
      expect(renamed.previousFilePath).toBe(created.filePath);

      const content = await fs.readFile(renamed.filePath, "utf8");
      expect(content).toContain("Rename me.");
      expect(content).toContain('title: "New Title"');
    } finally {
      process.chdir(origCwd);
    }
  });

  test("deletes an existing note", async () => {
    const origCwd = process.cwd();
    process.chdir(testDir);

    try {
      const created = await createNewNote("Disposable Note", {
        body: "This note can be deleted.",
      });

      const deleted = await deleteNote(created.id);

      expect(deleted.id).toBe(created.id);
      await expect(fs.stat(deleted.filePath)).rejects.toThrow();
    } finally {
      process.chdir(origCwd);
    }
  });

  test("reads an existing note with parsed metadata", async () => {
    const origCwd = process.cwd();
    process.chdir(testDir);

    try {
      const created = await createNewNote("Read Note", {
        body: "A note body for direct read access.",
        tags: ["read", "mcp"],
      });

      const note = await readNote(created.id, {
        notesDir: "notes",
      });

      expect(note.id).toBe(created.id);
      expect(note.title).toBe("Read Note");
      expect(note.body).toContain("A note body for direct read access.");
      expect(note.tags).toEqual(["read", "mcp"]);
      expect(note.content).toContain("## Links");
    } finally {
      process.chdir(origCwd);
    }
  });

  test("searches notes by body, tags, and summary", async () => {
    const origCwd = process.cwd();
    process.chdir(testDir);

    try {
      await createNewNote("Search One", {
        body: "This note mentions MCP integration in the body.",
        tags: ["agent"],
      });
      await createNewNote("Search Two", {
        body: "Another body with a different idea.",
        tags: ["workflow", "agent"],
      });

      const results = await searchNotes("MCP", {
        notesDir: "notes",
      });
      expect(results.count).toBe(1);
      expect(results.notes[0]?.title).toBe("Search One");
      expect(results.notes[0]?.matchedFields).toContain("body");
      expect(results.notes[0]?.snippet).toContain("MCP integration");

      const taggedResults = await searchNotes("workflow", {
        notesDir: "notes",
        tags: ["workflow"],
      });
      expect(taggedResults.count).toBe(1);
      expect(taggedResults.notes[0]?.title).toBe("Search Two");
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

  test("rename command updates the note filename and title", async () => {
    const origCwd = process.cwd();
    process.chdir(testDir);

    try {
      const created = await createNewNote("CLI Rename", {
        body: "Rename from the CLI.",
      });

      await expect(
        runNotesCommand({
          subcommand: "rename",
          id: created.id,
          title: "CLI Renamed",
        }),
      ).resolves.toBe(0);

      const notes = await listNotes("notes");
      const renamed = notes.find((note) => note.id === created.id);
      expect(renamed?.title).toBe("CLI Renamed");
      expect(
        await fs.readFile(
          path.join(testDir, "notes", renamed?.fileName ?? ""),
          "utf8",
        ),
      ).toContain("Rename from the CLI.");
    } finally {
      process.chdir(origCwd);
    }
  });

  test("delete command removes the note file", async () => {
    const origCwd = process.cwd();
    process.chdir(testDir);

    try {
      const created = await createNewNote("CLI Delete", {
        body: "Delete from the CLI.",
      });

      await expect(
        runNotesCommand({
          subcommand: "delete",
          id: created.id,
        }),
      ).resolves.toBe(0);

      await expect(fs.stat(created.filePath)).rejects.toThrow();
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

  test("tracks unresolved links in the note graph", async () => {
    const notesDir = path.join(testDir, "notes");

    await fs.writeFile(
      path.join(notesDir, "broken-link.md"),
      `---
id: 20260413170000
aliases: []
tags: []
---

# Broken Link

This note points to [[Missing Note]] and [[Also Missing|display text]].
`,
    );

    const graph = await buildNoteGraph("notes", testDir, false);
    const brokenLinks = getBrokenLinks(graph);

    expect(brokenLinks).toHaveLength(2);
    expect(brokenLinks.map((issue) => issue.reference)).toContain(
      "Missing Note",
    );
    expect(brokenLinks.map((issue) => issue.reference)).toContain(
      "Also Missing|display text",
    );
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

  test("links subcommand reports unresolved links for a note", async () => {
    const origCwd = process.cwd();
    process.chdir(testDir);

    try {
      const note = await createNewNote("Link Audit Note");
      await fs.writeFile(
        note.filePath,
        `---
id: ${note.id}
aliases: []
tags: []
---

# Link Audit Note

This note points to [[Missing Note]].
`,
        "utf8",
      );

      const capture = createBufferedCommandIo();

      expect(
        await runNotesCommand({ subcommand: "links", id: note.id }, capture.io),
      ).toBe(0);

      expect(capture.logs()).toContain("Broken links:");
      expect(capture.logs()).toContain("Missing Note");
    } finally {
      process.chdir(origCwd);
    }
  });
});
