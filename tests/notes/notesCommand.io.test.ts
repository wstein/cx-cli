import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runNotesCommand } from "../../src/cli/commands/notes.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";
import { parseJsonOutput } from "../helpers/cli/parseJsonOutput.js";

let testDir: string;
let originalCwd: string;

beforeEach(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-notes-io-"));
  await fs.mkdir(path.join(testDir, "notes"), { recursive: true });
  originalCwd = process.cwd();
  process.chdir(testDir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await fs.rm(testDir, { recursive: true, force: true });
});

describe("runNotesCommand I/O injection", () => {
  test("writes human output through injected log and stdout writers", async () => {
    const createCapture = createBufferedCommandIo();
    const createExitCode = await runNotesCommand(
      {
        subcommand: "new",
        title: "Injected Note",
        body: "Injected body.",
      },
      createCapture.io,
    );
    expect(createExitCode).toBe(0);

    const createdNoteId = createCapture
      .logs()
      .match(/Created note: (\d+)/)?.[1];
    expect(createdNoteId).toBeDefined();

    const readCapture = createBufferedCommandIo();
    const readExitCode = await runNotesCommand(
      {
        subcommand: "read",
        id: createdNoteId,
      },
      readCapture.io,
    );

    expect(readExitCode).toBe(0);
    expect(readCapture.logs()).toContain("Read note:");
    expect(readCapture.logs()).toContain("Title: Injected Note");
    expect(readCapture.stdout()).toContain("Injected body.");
  });

  test("writes JSON output through the injected stdout writer", async () => {
    const capture = createBufferedCommandIo();
    const exitCode = await runNotesCommand(
      {
        subcommand: "new",
        title: "Injected JSON Note",
        json: true,
      },
      capture.io,
    );

    expect(exitCode).toBe(0);
    const payload = parseJsonOutput<Record<string, unknown>>(capture.stdout());
    expect(payload.title).toBe("Injected JSON Note");
    expect(payload.id).toBeDefined();
  });
});
