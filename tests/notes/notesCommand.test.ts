import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runNotesCommand } from "../../src/cli/commands/notes.js";
import { captureCli } from "../helpers/cli/captureCli.js";

let testDir: string;
let origCwd: string;

beforeEach(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-notes-cmd-"));
  await fs.mkdir(path.join(testDir, "notes"));
  origCwd = process.cwd();
  process.chdir(testDir);
});

afterEach(async () => {
  process.chdir(origCwd);
  await fs.rm(testDir, { recursive: true, force: true });
});

describe("Notes Command Subcommands", () => {
  describe("new subcommand", () => {
    test("creates a note with text output", async () => {
      const result = await captureCli({
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
      const result = await captureCli({
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
      const result = await captureCli({
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
      const created = await captureCli({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "Read Test",
            body: "This is the note body.",
            json: true,
          }),
        parseJson: true,
      });

      const noteId = (created.parsedJson as Record<string, unknown>)
        .id as string;

      const result = await captureCli({
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
      expect(result.logs).toContain("This is the note body.");
    });

    test("reads a note with JSON output", async () => {
      const created = await captureCli({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "JSON Read",
            body: "JSON body",
            tags: ["json"],
            json: true,
          }),
        parseJson: true,
      });

      const noteId = (created.parsedJson as Record<string, unknown>)
        .id as string;

      const result = await captureCli({
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
      const created = await captureCli({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "Update Test",
            body: "Original body",
            json: true,
          }),
        parseJson: true,
      });

      const noteId = (created.parsedJson as Record<string, unknown>)
        .id as string;

      const result = await captureCli({
        run: () =>
          runNotesCommand({
            subcommand: "update",
            id: noteId,
            body: "Updated body",
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.logs).toContain("Updated note:");
    });

    test("updates note with JSON output", async () => {
      const created = await captureCli({
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

      const result = await captureCli({
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
      const created = await captureCli({
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
      const created = await captureCli({
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

      const result = await captureCli({
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
      const created = await captureCli({
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

      const result = await captureCli({
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
  });

  describe("delete subcommand", () => {
    test("deletes note with text output", async () => {
      const created = await captureCli({
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

      const result = await captureCli({
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
      const created = await captureCli({
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

      const result = await captureCli({
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
  });

  describe("list subcommand", () => {
    test("lists notes with text output", async () => {
      await captureCli({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "List Test 1",
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      await captureCli({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "List Test 2",
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      const result = await captureCli({
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
      await captureCli({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "JSON List 1",
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      const result = await captureCli({
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
      const result = await captureCli({
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
      const created = await captureCli({
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

      const result = await captureCli({
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
  });

  describe("orphans subcommand", () => {
    test("identifies orphan notes with text output", async () => {
      await captureCli({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "Orphan Note",
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      const result = await captureCli({
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
      await captureCli({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "Orphan JSON",
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      const result = await captureCli({
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
      const result = await captureCli({
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
      const created = await captureCli({
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

      const result = await captureCli({
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
  });

  describe("links subcommand", () => {
    test("global links with no broken links", async () => {
      const result = await captureCli({
        run: () =>
          runNotesCommand({
            subcommand: "links",
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.logs).toContain("No unresolved links");
    });

    test("per-note links with JSON output", async () => {
      const created = await captureCli({
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

      const result = await captureCli({
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
  });

  describe("check subcommand", () => {
    test("passes check for valid notes", async () => {
      await captureCli({
        run: () =>
          runNotesCommand({
            subcommand: "new",
            title: "Valid Note",
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      const result = await captureCli({
        run: () =>
          runNotesCommand({
            subcommand: "check",
          }),
        parseJson: false,
        captureConsoleLog: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.logs).toContain("consistency check");
      expect(result.logs).toContain("✓");
    });

    test("outputs JSON format", async () => {
      const result = await captureCli({
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
    });
  });

  describe("coverage subcommand", () => {
    test("shows coverage percentage", async () => {
      const result = await captureCli({
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

    test("outputs JSON format", async () => {
      const result = await captureCli({
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
