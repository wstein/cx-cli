// test-lane: integration
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  type NotesArgs,
  runNotesCommand as runNotesCommandBase,
} from "../../src/cli/commands/notes.js";
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
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";

const NOTES_DIR = "notes";

let testDir: string;

function noteOptions<T extends Record<string, unknown> = Record<string, never>>(
  options?: T,
): T & { notesDir: string; workspaceRoot: string } {
  return {
    notesDir: NOTES_DIR,
    workspaceRoot: testDir,
    ...(options ?? ({} as T)),
  };
}

function runNotesCommand(
  args: NotesArgs,
  io?: Parameters<typeof runNotesCommandBase>[1],
): Promise<number> {
  return runNotesCommandBase(
    {
      ...args,
      workspaceRoot: testDir,
    },
    io,
  );
}

beforeEach(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-notes-test-"));
  await fs.mkdir(path.join(testDir, NOTES_DIR));
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
});

describe("Notes Commands", () => {
  test("creates a new note with auto-generated ID", async () => {
    const { id, filePath } = await createNewNote(
      "Test Note",
      noteOptions({
        tags: ["test", "demo"],
      }),
    );

    expect(id).toMatch(/^\d{14}$/);
    expect(filePath).toContain("Test Note");
    expect(filePath).toContain(".md");

    const content = await fs.readFile(filePath, "utf-8");
    expect(content).toContain(`id: ${id}`);
    expect(content).not.toContain("title: Test Note");
    expect(content).toContain(
      "This note captures durable context about Test Note for later review and routing.",
    );
    expect(content).toContain("## What");
    expect(content).toContain("## Why");
    expect(content).toContain("## How");
    expect(content).toContain("test");
    expect(content).toContain("demo");
  });

  test("creates a new note with an initial body", async () => {
    const { filePath } = await createNewNote(
      "Body Note",
      noteOptions({
        body: "This note starts with a concrete summary.",
      }),
    );

    const content = await fs.readFile(filePath, "utf-8");
    expect(content).toContain("This note starts with a concrete summary.");
    expect(content).toContain("## Links");
    expect(content).not.toContain(
      "Summarize the note in one or two sentences so agents can route to it quickly from the manifest.",
    );
  });

  test("rejects note creation when the body cannot produce a summary", async () => {
    await expect(
      createNewNote(
        "Invalid Note",
        noteOptions({
          body: "## Links\n\n- [[Missing Summary]]",
        }),
      ),
    ).rejects.toThrow("Missing required summary paragraph");
  });

  test("updates an existing note body and tags", async () => {
    const created = await createNewNote(
      "Update Note",
      noteOptions({
        body: "This original note body keeps enough routing words today.",
        tags: ["old"],
      }),
    );

    const updated = await updateNote(
      created.id,
      noteOptions({
        body: "This revised note body keeps enough routing words today.",
        tags: ["new", "better"],
      }),
    );

    expect(updated.tags).toEqual(["new", "better"]);

    const content = await fs.readFile(updated.filePath, "utf8");
    expect(content).toContain(
      "This revised note body keeps enough routing words today.",
    );
    expect(content).toContain("new");
    expect(content).not.toContain(
      "This original note body keeps enough routing words today.",
    );
  });

  test("renames an existing note without changing its id", async () => {
    const created = await createNewNote(
      "Old Title",
      noteOptions({
        body: "This note is ready for a rename today.",
      }),
    );

    const renamed = await renameNote(created.id, "New Title", noteOptions());

    expect(renamed.id).toBe(created.id);
    expect(renamed.title).toBe("New Title");
    expect(path.basename(renamed.filePath)).toContain("New Title");
    expect(renamed.previousFilePath).toBe(created.filePath);

    const content = await fs.readFile(renamed.filePath, "utf8");
    expect(content).toContain("This note is ready for a rename today.");
    expect(content).toContain('title: "New Title"');
  });

  test("deletes an existing note", async () => {
    const created = await createNewNote(
      "Disposable Note",
      noteOptions({
        body: "This note can be deleted after the workflow check.",
      }),
    );

    const deleted = await deleteNote(created.id, noteOptions());

    expect(deleted.id).toBe(created.id);
    await expect(fs.stat(deleted.filePath)).rejects.toThrow();
  });

  test("reads an existing note with parsed metadata", async () => {
    const created = await createNewNote(
      "Read Note",
      noteOptions({
        body: "A note body for direct read access.",
        tags: ["read", "mcp"],
      }),
    );

    const note = await readNote(created.id, noteOptions());

    expect(note.id).toBe(created.id);
    expect(note.title).toBe("Read Note");
    expect(note.body).toContain("A note body for direct read access.");
    expect(note.tags).toEqual(["read", "mcp"]);
    expect(note.content).toContain("## Links");
  });

  test("searches notes by body, tags, and summary", async () => {
    await createNewNote(
      "Search One",
      noteOptions({
        body: "This note mentions MCP integration in the body.",
        tags: ["agent"],
      }),
    );
    await createNewNote(
      "Search Two",
      noteOptions({
        body: "Another body with a different idea.",
        tags: ["workflow", "agent"],
      }),
    );

    const results = await searchNotes("MCP", noteOptions());
    expect(results.count).toBe(1);
    expect(results.notes[0]?.title).toBe("Search One");
    expect(results.notes[0]?.matchedFields).toContain("body");
    expect(results.notes[0]?.snippet).toContain("MCP integration");

    const taggedResults = await searchNotes(
      "workflow",
      noteOptions({
        tags: ["workflow"],
      }),
    );
    expect(taggedResults.count).toBe(1);
    expect(taggedResults.notes[0]?.title).toBe("Search Two");
  });

  test("lists all notes", async () => {
    await createNewNote("Note 1", noteOptions({ tags: ["tag1"] }));
    await createNewNote("Note 2", noteOptions({ tags: ["tag2"] }));

    const notes = await listNotes(NOTES_DIR, { workspaceRoot: testDir });
    expect(notes.length).toBeGreaterThanOrEqual(2);
    expect(notes.some((note) => note.title === "Note 1")).toBe(true);
    expect(notes.some((note) => note.title === "Note 2")).toBe(true);
  });

  test("new command throws if title is missing", async () => {
    await expect(runNotesCommand({ subcommand: "new" })).rejects.toThrow(
      "--title is required",
    );
  });

  test("rename command updates the note filename and title", async () => {
    const created = await createNewNote(
      "CLI Rename",
      noteOptions({
        body: "This note can be renamed from the CLI safely.",
      }),
    );

    await expect(
      runNotesCommand({
        subcommand: "rename",
        id: created.id,
        title: "CLI Renamed",
      }),
    ).resolves.toBe(0);

    const notes = await listNotes(NOTES_DIR, { workspaceRoot: testDir });
    const renamed = notes.find((note) => note.id === created.id);
    expect(renamed?.title).toBe("CLI Renamed");
    expect(
      await fs.readFile(
        path.join(testDir, NOTES_DIR, renamed?.fileName ?? ""),
        "utf8",
      ),
    ).toContain("This note can be renamed from the CLI safely.");
  });

  test("delete command removes the note file", async () => {
    const created = await createNewNote(
      "CLI Delete",
      noteOptions({
        body: "This note can be deleted from the CLI safely.",
      }),
    );

    await expect(
      runNotesCommand({
        subcommand: "delete",
        id: created.id,
      }),
    ).resolves.toBe(0);

    await expect(fs.stat(created.filePath)).rejects.toThrow();
  });
});

describe("Notes Graph", () => {
  test("builds a note graph with wikilinks", async () => {
    const note1 = await createNewNote("First Note", noteOptions());
    const note2 = await createNewNote("Second Note", noteOptions());

    const note1Path = note1.filePath;
    let content = await fs.readFile(note1Path, "utf-8");
    content += `\n\nSee also: [[${note2.id}]]\n`;
    await fs.writeFile(note1Path, content);

    const graph = await buildNoteGraph(NOTES_DIR, testDir, false);
    expect(graph.notes.size).toBeGreaterThan(0);
    expect(graph.links.length).toBeGreaterThan(0);
  });

  test("detects orphan notes", async () => {
    const orphan1 = await createNewNote("Orphan 1", noteOptions());
    await createNewNote("Orphan 2", noteOptions());

    const graph = await buildNoteGraph(NOTES_DIR, testDir, false);
    expect(graph.orphans.length).toBeGreaterThan(0);
    expect(graph.orphans).toContain(orphan1.id);
  });

  test("getBacklinks returns notes linking to a target", async () => {
    const target = await createNewNote("Target Note", noteOptions());
    const source1 = await createNewNote("Source 1", noteOptions());

    const sourcePath = source1.filePath;
    let content = await fs.readFile(sourcePath, "utf-8");
    content += `\n\nLinks to: [[${target.id}]]\n`;
    await fs.writeFile(sourcePath, content);

    const graph = await buildNoteGraph(NOTES_DIR, testDir, false);
    const backlinks = getBacklinks(graph, target.id);
    expect(backlinks.length).toBeGreaterThan(0);
  });

  test("tracks unresolved links in the note graph", async () => {
    const notesDir = path.join(testDir, NOTES_DIR);

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

    const graph = await buildNoteGraph(NOTES_DIR, testDir, false);
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
    await createNewNote("Note A", noteOptions());
    await createNewNote("Note B", noteOptions());

    const notes = await listNotes(NOTES_DIR, { workspaceRoot: testDir });
    expect(notes.length).toBeGreaterThanOrEqual(2);
  });

  test("new subcommand creates a note with title and tags", async () => {
    const { id } = await createNewNote(
      "My New Note",
      noteOptions({
        tags: ["important", "architecture"],
      }),
    );

    const notes = await listNotes(NOTES_DIR, { workspaceRoot: testDir });
    const created = notes.find((note) => note.id === id);

    expect(created).toBeDefined();
    expect(created?.title).toBe("My New Note");
    expect(created?.tags).toContain("important");
    expect(created?.tags).toContain("architecture");
  });

  test("orphans subcommand identifies unlinked notes", async () => {
    const orphan = await createNewNote("Isolated Note", noteOptions());
    const graph = await buildNoteGraph(NOTES_DIR, testDir, false);

    expect(graph.orphans).toContain(orphan.id);
  });

  test("links subcommand reports unresolved links for a note", async () => {
    const note = await createNewNote("Link Audit Note", noteOptions());
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
  });
});
