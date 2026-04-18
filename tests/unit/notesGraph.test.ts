import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildNoteGraph,
  getBacklinks,
  getBrokenLinks,
  getCodeReferences,
  getOutgoingLinks,
} from "../../src/notes/graph.js";

let testDir: string;

const writeNote = async (
  dir: string,
  id: string,
  title: string,
  body = "",
): Promise<void> => {
  const content = `---
id: ${id}
aliases: []
tags: []
---

# ${title}

${body}
`;
  await fs.writeFile(path.join(dir, `${id}-${title}.md`), content);
};

beforeEach(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-graph-test-"));
  await fs.mkdir(path.join(testDir, "notes"));
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
});

describe("getOutgoingLinks", () => {
  test("returns outgoing links from a note", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(
      notesDir,
      "20260101120000",
      "Source",
      "See [[20260101130000]].",
    );
    await writeNote(notesDir, "20260101130000", "Target");

    const graph = await buildNoteGraph("notes", testDir, false);
    const outgoing = getOutgoingLinks(graph, "20260101120000");

    expect(outgoing).toHaveLength(1);
    expect(outgoing[0]?.toNoteId).toBe("20260101130000");
    expect(outgoing[0]?.title).toBe("Target");
  });

  test("returns empty array for note with no outgoing links", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(notesDir, "20260101120000", "Lonely");

    const graph = await buildNoteGraph("notes", testDir, false);
    const outgoing = getOutgoingLinks(graph, "20260101120000");

    expect(outgoing).toEqual([]);
  });

  test("uses 'Unknown' for missing target title", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(
      notesDir,
      "20260101120000",
      "Source",
      "See [[20260101130000]].",
    );
    await writeNote(notesDir, "20260101130000", "Target");

    const graph = await buildNoteGraph("notes", testDir, false);
    graph.notes.delete("20260101130000");

    const outgoing = getOutgoingLinks(graph, "20260101120000");
    expect(outgoing[0]?.title).toBe("Unknown");
  });
});

describe("getBacklinks", () => {
  test("uses 'Unknown' for missing source title", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(
      notesDir,
      "20260101120000",
      "Source",
      "See [[20260101130000]].",
    );
    await writeNote(notesDir, "20260101130000", "Target");

    const graph = await buildNoteGraph("notes", testDir, false);
    graph.notes.delete("20260101120000");

    const backlinks = getBacklinks(graph, "20260101130000");
    expect(backlinks[0]?.title).toBe("Unknown");
  });

  test("returns empty array for note with no backlinks", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(notesDir, "20260101120000", "Alone");

    const graph = await buildNoteGraph("notes", testDir, false);
    expect(getBacklinks(graph, "20260101120000")).toEqual([]);
  });
});

describe("getCodeReferences", () => {
  test("returns code references to a note", async () => {
    const notesDir = path.join(testDir, "notes");
    const srcDir = path.join(testDir, "src");
    await fs.mkdir(srcDir, { recursive: true });

    await writeNote(notesDir, "20260101120000", "Target");
    await fs.writeFile(
      path.join(srcDir, "example.ts"),
      "// See [[20260101120000]] for details\nexport const x = 1;\n",
    );

    const graph = await buildNoteGraph("notes", testDir, true);
    const refs = getCodeReferences(graph, "20260101120000");

    expect(refs.length).toBeGreaterThan(0);
    expect(refs[0]).toContain("example.ts");
  });

  test("returns empty array when no code references exist", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(notesDir, "20260101120000", "No Code Refs");

    const graph = await buildNoteGraph("notes", testDir, false);
    expect(getCodeReferences(graph, "20260101120000")).toEqual([]);
  });
});

describe("getBrokenLinks", () => {
  test("returns all broken links when noteId is undefined", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(
      notesDir,
      "20260101120000",
      "Source",
      "[[Missing1]] and [[Missing2]].",
    );

    const graph = await buildNoteGraph("notes", testDir, false);
    const broken = getBrokenLinks(graph);

    expect(broken.length).toBe(2);
  });

  test("filters broken links by noteId", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(notesDir, "20260101120000", "SourceA", "[[MissingA]].");
    await writeNote(notesDir, "20260101130000", "SourceB", "[[MissingB]].");

    const graph = await buildNoteGraph("notes", testDir, false);
    const brokenA = getBrokenLinks(graph, "20260101120000");
    const brokenB = getBrokenLinks(graph, "20260101130000");

    expect(brokenA).toHaveLength(1);
    expect(brokenA[0]?.reference).toBe("MissingA");
    expect(brokenB).toHaveLength(1);
    expect(brokenB[0]?.reference).toBe("MissingB");
  });
});

describe("buildNoteGraph with code analysis", () => {
  test("skips code analysis when includeSrcAnalysis is false", async () => {
    const notesDir = path.join(testDir, "notes");
    const srcDir = path.join(testDir, "src");
    await fs.mkdir(srcDir, { recursive: true });

    await writeNote(notesDir, "20260101120000", "Target");
    await fs.writeFile(
      path.join(srcDir, "example.ts"),
      "// See [[20260101120000]]\n",
    );

    const graph = await buildNoteGraph("notes", testDir, false);
    expect(getCodeReferences(graph, "20260101120000")).toEqual([]);
  });

  test("handles missing src directory gracefully", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(notesDir, "20260101120000", "Target");

    const graph = await buildNoteGraph("notes", testDir, true);
    expect(getCodeReferences(graph, "20260101120000")).toEqual([]);
  });

  test("tracks broken code references", async () => {
    const srcDir = path.join(testDir, "src");
    await fs.mkdir(srcDir, { recursive: true });

    await fs.writeFile(
      path.join(srcDir, "broken.ts"),
      "// See [[MissingNote]] for details\n",
    );

    const graph = await buildNoteGraph("notes", testDir, true);
    const broken = getBrokenLinks(graph);

    expect(broken.some((b) => b.source === "code")).toBe(true);
  });

  test("handles binary/unreadable files silently", async () => {
    const notesDir = path.join(testDir, "notes");
    const srcDir = path.join(testDir, "src");
    await fs.mkdir(srcDir, { recursive: true });

    await writeNote(notesDir, "20260101120000", "Target");
    await fs.writeFile(
      path.join(srcDir, "valid.ts"),
      "// [[20260101120000]]\n",
    );

    const graph = await buildNoteGraph("notes", testDir, true);
    expect(getCodeReferences(graph, "20260101120000").length).toBeGreaterThan(
      0,
    );
  });
});
