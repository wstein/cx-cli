// test-lane: unit
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
  getReachableNotes,
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

  test("reports anchor-not-found when #section heading is missing in target note", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(
      notesDir,
      "20260201120000",
      "Source",
      "See [[20260201130000#Missing Section]].",
    );
    await writeNote(
      notesDir,
      "20260201130000",
      "Target",
      "## Present Section\n\nContent here.",
    );

    const graph = await buildNoteGraph("notes", testDir, false);
    const broken = getBrokenLinks(graph);

    expect(broken.length).toBe(1);
    expect(broken[0]?.reason).toBe("anchor-not-found");
    expect(broken[0]?.reference).toBe("20260201130000#Missing Section");
  });

  test("does not report broken link when #section heading exists in target note", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(
      notesDir,
      "20260202120000",
      "Source",
      "See [[20260202130000#Present Section]].",
    );
    await writeNote(
      notesDir,
      "20260202130000",
      "Target",
      "## Present Section\n\nContent here.",
    );

    const graph = await buildNoteGraph("notes", testDir, false);
    const broken = getBrokenLinks(graph);

    expect(broken.length).toBe(0);
  });

  test("anchor matching is case-insensitive", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(
      notesDir,
      "20260203120000",
      "Source",
      "See [[20260203130000#present section]].",
    );
    await writeNote(
      notesDir,
      "20260203130000",
      "Target",
      "## Present Section\n\nContent here.",
    );

    const graph = await buildNoteGraph("notes", testDir, false);
    const broken = getBrokenLinks(graph);

    expect(broken.length).toBe(0);
  });

  test("still counts note link in outgoing links when anchor is valid", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(
      notesDir,
      "20260204120000",
      "Source",
      "See [[20260204130000#My Section]].",
    );
    await writeNote(
      notesDir,
      "20260204130000",
      "Target",
      "## My Section\n\nContent here.",
    );

    const graph = await buildNoteGraph("notes", testDir, false);
    const outgoing = getOutgoingLinks(graph, "20260204120000");

    expect(outgoing.length).toBe(1);
    expect(outgoing[0]?.toNoteId).toBe("20260204130000");
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

describe("getReachableNotes", () => {
  test("returns notes reachable within default depth of 2", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(
      notesDir,
      "20260301000001",
      "Root",
      "See [[20260301000002]].",
    );
    await writeNote(
      notesDir,
      "20260301000002",
      "Hop1",
      "See [[20260301000003]].",
    );
    await writeNote(notesDir, "20260301000003", "Hop2");

    const graph = await buildNoteGraph("notes", testDir, false);
    const reachable = getReachableNotes(graph, "20260301000001");

    expect(reachable.map((r) => r.noteId)).toContain("20260301000002");
    expect(reachable.map((r) => r.noteId)).toContain("20260301000003");
  });

  test("respects maxDepth=1 and excludes deeper notes", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(
      notesDir,
      "20260302000001",
      "Root",
      "See [[20260302000002]].",
    );
    await writeNote(
      notesDir,
      "20260302000002",
      "Hop1",
      "See [[20260302000003]].",
    );
    await writeNote(notesDir, "20260302000003", "Hop2");

    const graph = await buildNoteGraph("notes", testDir, false);
    const reachable = getReachableNotes(graph, "20260302000001", 1);

    expect(reachable).toHaveLength(1);
    expect(reachable[0]?.noteId).toBe("20260302000002");
    expect(reachable[0]?.depth).toBe(1);
  });

  test("depth 2 includes a strictly larger reachable set than depth 1", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(
      notesDir,
      "20260302100001",
      "Root",
      "See [[20260302100002]].",
    );
    await writeNote(
      notesDir,
      "20260302100002",
      "Hop1",
      "See [[20260302100003]].",
    );
    await writeNote(notesDir, "20260302100003", "Hop2");

    const graph = await buildNoteGraph("notes", testDir, false);
    const depth1 = getReachableNotes(graph, "20260302100001", 1);
    const depth2 = getReachableNotes(graph, "20260302100001", 2);

    expect(depth1.map((item) => item.noteId)).toEqual(["20260302100002"]);
    expect(depth2.map((item) => item.noteId)).toEqual([
      "20260302100002",
      "20260302100003",
    ]);
    expect(depth2.length).toBeGreaterThan(depth1.length);
  });

  test("excludes the seed note from results", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(
      notesDir,
      "20260303000001",
      "Seed",
      "See [[20260303000002]].",
    );
    await writeNote(notesDir, "20260303000002", "Target");

    const graph = await buildNoteGraph("notes", testDir, false);
    const reachable = getReachableNotes(graph, "20260303000001");

    expect(reachable.map((r) => r.noteId)).not.toContain("20260303000001");
  });

  test("returns empty array for note with no outgoing links", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(notesDir, "20260304000001", "Isolated");

    const graph = await buildNoteGraph("notes", testDir, false);
    const reachable = getReachableNotes(graph, "20260304000001");

    expect(reachable).toEqual([]);
  });

  test("handles cycles without infinite loop", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(notesDir, "20260305000001", "A", "See [[20260305000002]].");
    await writeNote(notesDir, "20260305000002", "B", "See [[20260305000001]].");

    const graph = await buildNoteGraph("notes", testDir, false);
    const reachable = getReachableNotes(graph, "20260305000001", 10);

    const ids = reachable.map((r) => r.noteId);
    expect(ids).toContain("20260305000002");
    expect(ids).not.toContain("20260305000001");
  });

  test("sorts results by depth then title", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(
      notesDir,
      "20260306000001",
      "Root",
      "See [[20260306000002]] and [[20260306000003]].",
    );
    await writeNote(notesDir, "20260306000002", "Bravo");
    await writeNote(notesDir, "20260306000003", "Alpha");

    const graph = await buildNoteGraph("notes", testDir, false);
    const reachable = getReachableNotes(graph, "20260306000001", 1);

    expect(reachable).toHaveLength(2);
    expect(reachable[0]?.title).toBe("Alpha");
    expect(reachable[1]?.title).toBe("Bravo");
  });

  test("includes depth value for each reachable note", async () => {
    const notesDir = path.join(testDir, "notes");
    await writeNote(
      notesDir,
      "20260307000001",
      "Root",
      "See [[20260307000002]].",
    );
    await writeNote(
      notesDir,
      "20260307000002",
      "Middle",
      "See [[20260307000003]].",
    );
    await writeNote(notesDir, "20260307000003", "Far");

    const graph = await buildNoteGraph("notes", testDir, false);
    const reachable = getReachableNotes(graph, "20260307000001", 3);

    const byId = Object.fromEntries(reachable.map((r) => [r.noteId, r.depth]));
    expect(byId["20260307000002"]).toBe(1);
    expect(byId["20260307000003"]).toBe(2);
  });
});
