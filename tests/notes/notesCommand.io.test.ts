// test-lane: integration

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  type NotesArgs,
  runNotesCommand as runNotesCommandBase,
} from "../../src/cli/commands/notes.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";
import { parseJsonOutput } from "../helpers/cli/parseJsonOutput.js";

let testDir: string;

function runNotesCommand(
  args: NotesArgs,
  io?: Parameters<typeof runNotesCommandBase>[1],
) {
  return runNotesCommandBase(
    {
      ...args,
      workspaceRoot: testDir,
    },
    io,
  );
}

beforeEach(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-notes-io-"));
  await fs.mkdir(path.join(testDir, "notes"), { recursive: true });
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
});

describe("runNotesCommand I/O injection", () => {
  test("writes human output through injected log and stdout writers", async () => {
    const createCapture = createBufferedCommandIo();
    const createExitCode = await runNotesCommand(
      {
        subcommand: "new",
        title: "Injected Note",
        body: "This injected note body keeps enough routing words today.",
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
    expect(readCapture.stdout()).toContain(
      "This injected note body keeps enough routing words today.",
    );
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
