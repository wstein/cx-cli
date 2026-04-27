// test-lane: integration

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  type NotesArgs,
  runNotesCommand as runNotesCommandBase,
} from "../../src/cli/commands/notes.js";
import type { CommandIo } from "../../src/shared/output.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";
import { parseJsonOutput } from "../helpers/cli/parseJsonOutput.js";

let testDir: string;
let activeIo: Partial<CommandIo> | undefined;

function runNotesCommand(args: NotesArgs) {
  return runNotesCommandBase(
    {
      ...args,
      workspaceRoot: testDir,
    },
    activeIo,
  );
}

async function captureNotesCommand<T = unknown>(params: {
  run: () => Promise<number>;
  parseJson?: boolean;
  captureConsoleLog?: boolean;
}): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
  logs: string;
  parsedJson?: T;
}> {
  const capture = createBufferedCommandIo({ cwd: testDir });
  activeIo = capture.io;

  try {
    const exitCode = await params.run();
    const stdout = capture.stdout();
    return {
      exitCode,
      stdout,
      stderr: capture.stderr(),
      logs: capture.logs(),
      ...(params.parseJson
        ? { parsedJson: parseJsonOutput<T>(stdout || "{}") }
        : {}),
    };
  } finally {
    activeIo = undefined;
  }
}

function noteFilePath(fileName: string): string {
  return path.join(testDir, "notes", fileName);
}

beforeEach(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-notes-cmd-"));
  await fs.mkdir(path.join(testDir, "notes"));
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
});

describe("Notes Command Subcommands", () => {
  describe("lint subcommand", () => {
    test("writes frontmatter fixes and reads lint history", async () => {
      await fs.mkdir(path.join(testDir, "notes", "area"), { recursive: true });
      await fs.writeFile(
        path.join(testDir, "notes", "area", "lint.md"),
        `---
id: 20250113143009
title: Lint Note
tags: ["existing"]
updated_at: "2020-01-01"
---

Body content remains unchanged with enough routing words.`,
        "utf8",
      );

      const lintResult = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "lint",
            write: true,
            yes: true,
            json: true,
          }),
        parseJson: true,
      });

      expect(lintResult.exitCode).toBe(0);
      expect(lintResult.parsedJson).toMatchObject({
        command: "notes lint",
      });

      const historyResult = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "lint",
            history: true,
            json: true,
          }),
        parseJson: true,
      });
      expect(historyResult.exitCode).toBe(0);
      expect(historyResult.parsedJson).toMatchObject({
        command: "notes lint --history",
        count: 1,
      });
    });
  });

  describe("new subcommand", () => {
    test("creates a note with text output", async () => {
      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "Test Note",
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.logs).toContain("Created note:");
      expect(result.logs).toContain("File:");
      expect(result.logs).toContain("Title: Test Note");
    });

    test("creates a note with JSON output", async () => {
      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "JSON Note",
            json: true,
          }),
        parseJson: true,
      });

      expect(result.exitCode).toBe(0);
      const json = result.parsedJson as Record<string, unknown>;
      expect(json.id).toBeDefined();
      expect(json.title).toBe("JSON Note");
      expect(json.filePath).toBeDefined();
    });

    test("creates a note with tags", async () => {
      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "Tagged Note",
            tags: ["important", "architecture"],
            json: true,
          }),
        parseJson: true,
      });

      expect(result.exitCode).toBe(0);
      const json = result.parsedJson as Record<string, unknown>;
      expect(json.tags).toEqual(["important", "architecture"]);
    });

    test("creates a note with tags in text output", async () => {
      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "Tagged Text Note",
            tags: ["alpha", "beta"],
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.logs).toContain("Tags: alpha, beta");
    });

    test("throws when title is missing", async () => {
      await expect(
        runNotesCommand({
          subcommand: "new",
        }),
      ).rejects.toThrow("--title is required");
    });
  });

  describe("read subcommand", () => {
    test("reads an existing note with text output", async () => {
      // Create a note first
      const created = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "Read Test",
            body: "This is the note body with enough routing words.",
            json: true,
          }),
        parseJson: true,
      });

      const noteId = (created.parsedJson as Record<string, unknown>)
        .id as string;

      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "read",
            id: noteId,
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.logs).toContain("Read note:");
      expect(result.logs).toContain("Title: Read Test");
      expect(result.logs).toContain(
        "This is the note body with enough routing words.",
      );
    });

    test("reads a note with JSON output", async () => {
      const created = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "JSON Read",
            body: "JSON body with enough routing words.",
            tags: ["json"],
            json: true,
          }),
        parseJson: true,
      });

      const noteId = (created.parsedJson as Record<string, unknown>)
        .id as string;

      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "read",
            id: noteId,
            json: true,
          }),
        parseJson: true,
      });

      expect(result.exitCode).toBe(0);
      const json = result.parsedJson as Record<string, unknown>;
      expect(json.id).toBe(noteId);
      expect(json.title).toBe("JSON Read");
    });

    test("reads a note with aliases and tags in text output", async () => {
      await fs.writeFile(
        noteFilePath("20250113143015.md"),
        `---
id: 20250113143015
title: Alias Note
aliases: [Alias One, Alias Two]
tags: [test, example]
---

This note has aliases and tags.
`,
        "utf8",
      );

      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "read",
            id: "20250113143015",
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.logs).toContain("Aliases: Alias One, Alias Two");
      expect(result.logs).toContain("Tags: test, example");
    });

    test("throws when id is missing", async () => {
      await expect(
        runNotesCommand({
          subcommand: "read",
        }),
      ).rejects.toThrow("--id is required");
    });
  });

  describe("update subcommand", () => {
    test("updates note body with text output", async () => {
      const created = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "Update Test",
            body: "Original body with enough routing words.",
            json: true,
          }),
        parseJson: true,
      });

      const noteId = (created.parsedJson as Record<string, unknown>)
        .id as string;

      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "update",
            id: noteId,
            body: "Updated body with enough routing words.",
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.logs).toContain("Updated note:");
    });

    test("updates note with JSON output", async () => {
      const created = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "JSON Update",
            json: true,
          }),
        parseJson: true,
      });

      const noteId = (created.parsedJson as Record<string, unknown>)
        .id as string;

      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "update",
            id: noteId,
            tags: ["updated"],
            json: true,
          }),
        parseJson: true,
      });

      expect(result.exitCode).toBe(0);
      const json = result.parsedJson as Record<string, unknown>;
      expect(json.id).toBe(noteId);
    });

    test("throws when id is missing", async () => {
      await expect(
        runNotesCommand({
          subcommand: "update",
        }),
      ).rejects.toThrow("--id is required");
    });

    test("throws when no fields to update", async () => {
      const created = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "No Update Test",
            json: true,
          }),
        parseJson: true,
      });

      const noteId = (created.parsedJson as Record<string, unknown>)
        .id as string;

      await expect(
        runNotesCommand({
          subcommand: "update",
          id: noteId,
        }),
      ).rejects.toThrow("At least one of");
    });
  });

  describe("rename subcommand", () => {
    test("renames note with text output", async () => {
      const created = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "Original Name",
            json: true,
          }),
        parseJson: true,
      });

      const noteId = (created.parsedJson as Record<string, unknown>)
        .id as string;

      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "rename",
            id: noteId,
            title: "Renamed",
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.logs).toContain("Renamed note:");
      expect(result.logs).toContain("Title: Renamed");
    });

    test("renames note with JSON output", async () => {
      const created = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "JSON Rename",
            json: true,
          }),
        parseJson: true,
      });

      const noteId = (created.parsedJson as Record<string, unknown>)
        .id as string;

      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "rename",
            id: noteId,
            title: "JSON Renamed",
            json: true,
          }),
        parseJson: true,
      });

      expect(result.exitCode).toBe(0);
      const json = result.parsedJson as Record<string, unknown>;
      expect(json.title).toBe("JSON Renamed");
    });

    test("throws when title is missing", async () => {
      const created = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "Missing Title Test",
            json: true,
          }),
        parseJson: true,
      });

      const noteId = (created.parsedJson as Record<string, unknown>)
        .id as string;

      await expect(
        runNotesCommand({
          subcommand: "rename",
          id: noteId,
        }),
      ).rejects.toThrow("--title is required");
    });
  });

  describe("delete subcommand", () => {
    test("deletes note with text output", async () => {
      const created = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "Disposable",
            json: true,
          }),
        parseJson: true,
      });

      const noteId = (created.parsedJson as Record<string, unknown>)
        .id as string;

      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "delete",
            id: noteId,
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.logs).toContain("Deleted note:");
    });

    test("deletes note with JSON output", async () => {
      const created = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "JSON Delete",
            json: true,
          }),
        parseJson: true,
      });

      const noteId = (created.parsedJson as Record<string, unknown>)
        .id as string;

      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "delete",
            id: noteId,
            json: true,
          }),
        parseJson: true,
      });

      expect(result.exitCode).toBe(0);
      const json = result.parsedJson as Record<string, unknown>;
      expect(json.id).toBe(noteId);
    });

    test("throws when id is missing", async () => {
      await expect(
        runNotesCommand({
          subcommand: "delete",
        }),
      ).rejects.toThrow("--id is required");
    });
  });

  describe("list subcommand", () => {
    test("lists notes with text output", async () => {
      await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "List Test 1",
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "List Test 2",
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "list",
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.logs).toContain("Found");
      expect(result.logs).toContain("List Test 1");
      expect(result.logs).toContain("List Test 2");
    });

    test("lists notes with JSON output", async () => {
      await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "JSON List 1",
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "list",
            json: true,
          }),
        parseJson: true,
      });

      expect(result.exitCode).toBe(0);
      const json = result.parsedJson as Record<string, unknown>;
      expect(json.count).toBeGreaterThanOrEqual(1);
      expect(json.notes).toBeDefined();
    });

    test("handles empty notes directory", async () => {
      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "list",
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.logs).toContain("No notes found");
    });
  });

  describe("backlinks subcommand", () => {
    test("shows no backlinks for isolated note", async () => {
      const created = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "Isolated",
            json: true,
          }),
        parseJson: true,
      });

      const noteId = (created.parsedJson as Record<string, unknown>)
        .id as string;

      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "backlinks",
            id: noteId,
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.logs).toContain("no backlinks");
    });

    test("throws when id is missing", async () => {
      await expect(
        runNotesCommand({
          subcommand: "backlinks",
        }),
      ).rejects.toThrow("--id is required");
    });

    test("shows backlinks for a referenced note", async () => {
      await fs.writeFile(
        noteFilePath("20250113143016.md"),
        `---
id: 20250113143016
title: Source Note
---

See [[Target Note]] while keeping enough routing words for validation.
`,
        "utf8",
      );
      await fs.writeFile(
        noteFilePath("20250113143017.md"),
        `---
id: 20250113143017
title: Target Note
---

Target content with enough routing words for validation.
`,
        "utf8",
      );

      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "backlinks",
            id: "20250113143017",
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.logs).toContain('Backlinks to "Target Note"');
      expect(result.logs).toContain("[20250113143016] Source Note");
    });
  });

  describe("orphans subcommand", () => {
    test("identifies orphan notes with text output", async () => {
      await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "Orphan Note",
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "orphans",
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.logs).toContain("Orphan");
    });

    test("outputs JSON format", async () => {
      await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "Orphan JSON",
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "orphans",
            json: true,
          }),
        parseJson: true,
      });

      expect(result.exitCode).toBe(0);
      const json = result.parsedJson as Record<string, unknown>;
      expect(json.orphans).toBeDefined();
    });

    test("handles no orphans", async () => {
      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "orphans",
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.logs).toContain("No orphan notes");
    });
  });

  describe("code-links subcommand", () => {
    test("shows no code references for note", async () => {
      const created = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "No Code Links",
            json: true,
          }),
        parseJson: true,
      });

      const noteId = (created.parsedJson as Record<string, unknown>)
        .id as string;

      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "code-links",
            id: noteId,
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.logs).toContain("no code references");
    });

    test("throws when id is missing", async () => {
      await expect(
        runNotesCommand({
          subcommand: "code-links",
        }),
      ).rejects.toThrow("--id is required");
    });

    test("returns code links in JSON output", async () => {
      await fs.mkdir(path.join(testDir, "src"), { recursive: true });
      await fs.writeFile(
        noteFilePath("20250113143018.md"),
        `---
id: 20250113143018
title: Code Link Note
---

Note content with enough routing words for validation.
`,
        "utf8",
      );
      await fs.writeFile(
        path.join(testDir, "src", "app.ts"),
        `// Reference the note via wikilink
// [[Code Link Note]]
`,
        "utf8",
      );

      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "code-links",
            id: "20250113143018",
            json: true,
          }),
        parseJson: true,
      });

      expect(result.exitCode).toBe(0);
      const json = result.parsedJson as Record<string, unknown>;
      expect(json.codeFiles).toContain("src/app.ts");
    });
  });

  describe("links subcommand", () => {
    test("global links with no broken links", async () => {
      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "links",
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.logs).toContain("No broken links found in notes/");
    });

    test("per-note links with JSON output", async () => {
      const created = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "Links Test",
            json: true,
          }),
        parseJson: true,
      });

      const noteId = (created.parsedJson as Record<string, unknown>)
        .id as string;

      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "links",
            id: noteId,
            json: true,
          }),
        parseJson: true,
      });

      expect(result.exitCode).toBe(0);
      const json = result.parsedJson as Record<string, unknown>;
      expect(json.noteId).toBe(noteId);
      expect(json.outgoing).toBeDefined();
    });

    test("shows outgoing and broken links in text output", async () => {
      await fs.writeFile(
        noteFilePath("20250113143019.md"),
        `---
id: 20250113143019
aliases: []
tags: []
title: Links Source
---

This source note links to one valid note and one missing note.

See [[Links Target]] and [[Missing Note]].
`,
        "utf8",
      );
      await fs.writeFile(
        noteFilePath("20250113143020.md"),
        `---
id: 20250113143020
aliases: []
tags: []
title: Links Target
---

This target note exists and should appear as an outgoing link.
`,
        "utf8",
      );

      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "links",
            id: "20250113143019",
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.logs).toContain("Outgoing:");
      expect(result.logs).toContain("[20250113143020] Links Target");
      expect(result.logs).toContain("Broken links:");
      expect(result.logs).toContain("unresolved");
    });
  });

  describe("check subcommand", () => {
    test("passes check for valid notes", async () => {
      await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "Valid Note",
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "check",
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.logs).toContain("consistency check");
      expect(result.logs).toContain("Cognition score");
      expect(result.logs).toContain("Trust model");
      expect(result.logs).toContain("Staleness");
      expect(result.logs).toContain("✓");
    });

    test("outputs JSON format", async () => {
      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "check",
            json: true,
          }),
        parseJson: true,
      });

      expect(result.exitCode).toBe(0);
      const json = result.parsedJson as Record<string, unknown>;
      expect(json.command).toBe("notes check");
      expect(json.valid).toBeDefined();
      expect(json.cognition).toBeDefined();
      expect(json.staleness).toBeDefined();
      expect(json.trustModel).toBeDefined();
    });

    test("surfaces note governance validation failures", async () => {
      await fs.writeFile(
        noteFilePath("20250113143009-invalid.md"),
        `---
id: 20250113143009
aliases: []
tags: []
---

## Links

- [[Missing Summary]]
`,
      );

      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "check",
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      expect(result.exitCode).toBe(1);
      expect(result.logs).toContain("Validation errors");
      expect(result.logs).toContain("Missing required summary paragraph");
    });

    test("surfaces code-path drift warnings without failing the check", async () => {
      await fs.writeFile(
        noteFilePath("20250113143004-code-path.md"),
        `---
id: 20250113143004
title: Code Path Warning
---

Check [[src/missing.ts]] before touching the pipeline with enough routing words.
`,
      );

      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "check",
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.logs).toContain("Code path drift warnings");
      expect(result.logs).toContain("missing from repository");
    });
  });

  describe("coverage subcommand", () => {
    test("shows coverage percentage", async () => {
      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "coverage",
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.logs).toContain("coverage");
      expect(result.logs).toContain("tools");
    });

    test("graph subcommand returns reachable notes in text output", async () => {
      await fs.writeFile(
        noteFilePath("20250113143021.md"),
        `---
id: 20250113143021
title: Graph Root
---

See [[Graph Hop]] with enough routing words for validation.
`,
        "utf8",
      );
      await fs.writeFile(
        noteFilePath("20250113143022.md"),
        `---
id: 20250113143022
title: Graph Hop
---

Terminal note with enough routing words for validation.
`,
        "utf8",
      );

      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "graph",
            id: "20250113143021",
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.logs).toContain('Reachable notes from "Graph Root"');
      expect(result.logs).toContain("[20250113143022] Graph Hop");
    });

    test("graph subcommand outputs JSON", async () => {
      await fs.writeFile(
        noteFilePath("20250113143023.md"),
        `---
id: 20250113143023
title: Graph Root JSON
---

See [[Graph Hop JSON]] with enough routing words for validation.
`,
        "utf8",
      );
      await fs.writeFile(
        noteFilePath("20250113143024.md"),
        `---
id: 20250113143024
title: Graph Hop JSON
---

Terminal note with enough routing words for validation.
`,
        "utf8",
      );

      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "graph",
            id: "20250113143023",
            json: true,
          }),
        parseJson: true,
      });

      expect(result.exitCode).toBe(0);
      const json = result.parsedJson as Record<string, unknown>;
      expect(json.command).toBe("notes graph");
      expect(json.reachableCount).toBe(1);
    });

    test("graph subcommand outputs the unified graph with --format json", async () => {
      await fs.mkdir(path.join(testDir, "src"), { recursive: true });
      await fs.mkdir(path.join(testDir, "tests"), { recursive: true });
      await fs.mkdir(path.join(testDir, "docs"), { recursive: true });
      await fs.writeFile(path.join(testDir, "src", "index.ts"), "export {};\n");
      await fs.writeFile(
        path.join(testDir, "tests", "index.test.ts"),
        "import '../src/index';\n",
      );
      await fs.writeFile(path.join(testDir, "docs", "index.adoc"), "= Docs\n");
      await fs.writeFile(
        noteFilePath("20250113143025.md"),
        `---
id: 20250113143025
title: Unified Graph Source
kind: invariant
claims:
  - id: graph-claim
    type: invariant
    status: accepted
    code_refs:
      - src/index.ts
    test_refs:
      - tests/index.test.ts
    doc_refs:
      - docs/index.adoc
---

The unified graph note carries enough durable context for graph validation and downstream trace behavior.
`,
        "utf8",
      );

      const result = await captureNotesCommand<{
        command: string;
        nodes: Array<{ type: string }>;
        edges: Array<{ type: string; claimId?: string }>;
      }>({
        run: () =>
          runNotesCommand({
            subcommand: "graph",
            format: "json",
          }),
        parseJson: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.parsedJson?.command).toBe("notes graph");
      expect(result.parsedJson?.nodes.map((node) => node.type)).toContain(
        "note",
      );
      expect(result.parsedJson?.edges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "code_ref", claimId: "graph-claim" }),
          expect.objectContaining({ type: "test_ref", claimId: "graph-claim" }),
          expect.objectContaining({ type: "doc_ref", claimId: "graph-claim" }),
        ]),
      );
    });

    test("trace subcommand returns claim-backed evidence", async () => {
      await fs.mkdir(path.join(testDir, "src"), { recursive: true });
      await fs.writeFile(path.join(testDir, "src", "trace.ts"), "export {};\n");
      await fs.writeFile(
        noteFilePath("20250113143026.md"),
        `---
id: 20250113143026
title: Trace Source
claims:
  - id: trace-claim
    type: fact
    status: accepted
    code_refs:
      - src/trace.ts
---

The trace note carries enough durable context for linked evidence and note tracing behavior.
`,
        "utf8",
      );

      const result = await captureNotesCommand<{
        command: string;
        linkedCodeFiles: string[];
        note: { claims: Array<{ id: string }> };
      }>({
        run: () =>
          runNotesCommand({
            subcommand: "trace",
            id: "20250113143026",
            json: true,
          }),
        parseJson: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.parsedJson?.command).toBe("notes trace");
      expect(result.parsedJson?.linkedCodeFiles).toEqual(["src/trace.ts"]);
      expect(result.parsedJson?.note.claims).toEqual([
        expect.objectContaining({ id: "trace-claim" }),
      ]);
    });

    test("ask subcommand returns note-first evidence", async () => {
      await fs.writeFile(
        noteFilePath("20250113143027.md"),
        `---
id: 20250113143027
title: Docs Drift Evidence
tags: [docs, drift]
---

Docs drift checks generated pages against durable note evidence so stale generated documentation is visible.
`,
        "utf8",
      );

      const result = await captureNotesCommand<{
        command: string;
        matchedNotes: Array<{ id: string }>;
        confidence: string;
      }>({
        run: () =>
          runNotesCommand({
            subcommand: "ask",
            query: "How does docs drift work?",
            json: true,
          }),
        parseJson: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.parsedJson?.command).toBe("notes ask");
      expect(result.parsedJson?.confidence).toBe("medium");
      expect(result.parsedJson?.matchedNotes).toEqual([
        expect.objectContaining({ id: "20250113143027" }),
      ]);
    });

    test("drift subcommand reports a clean graph", async () => {
      await fs.writeFile(
        noteFilePath("20250113143028.md"),
        `---
id: 20250113143028
title: Clean Drift Note
---

The clean drift note has enough durable context and no missing implementation links.
`,
        "utf8",
      );

      const result = await captureNotesCommand<{
        command: string;
        valid: boolean;
      }>({
        run: () =>
          runNotesCommand({
            subcommand: "drift",
            json: true,
          }),
        parseJson: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.parsedJson).toEqual(
        expect.objectContaining({ command: "notes drift", valid: true }),
      );
    });

    test("outputs JSON format", async () => {
      const result = await captureNotesCommand({
        run: () =>
          runNotesCommand({
            subcommand: "coverage",
            json: true,
          }),
        parseJson: true,
      });

      expect(result.exitCode).toBe(0);
      const json = result.parsedJson as Record<string, unknown>;
      expect(json.command).toBe("notes coverage");
      expect(json.percentage).toBeDefined();
    });
  });

  describe("unknown subcommand", () => {
    test("throws for unknown subcommand", async () => {
      await expect(
        runNotesCommand({
          subcommand: "unknown",
        }),
      ).rejects.toThrow("Unknown notes subcommand");
    });
  });
});
