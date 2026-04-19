// test-lane: unit

import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { runBundleCommand } from "../../src/cli/commands/bundle.js";
import { runValidateCommand } from "../../src/cli/commands/validate.js";
import { createProject } from "../bundle/helpers.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";
import { parseJsonOutput } from "../helpers/cli/parseJsonOutput.js";

async function createBundleFixture(noteContents: string[]): Promise<{
  root: string;
  bundleDir: string;
}> {
  const project = await createProject();
  const bundleCapture = createBufferedCommandIo();
  expect(
    await runBundleCommand({ config: project.configPath }, bundleCapture.io),
  ).toBe(0);

  const bundleDir = path.join(project.root, "bundle");
  await fs.rm(bundleDir, { recursive: true, force: true });
  await fs.cp(project.bundleDir, bundleDir, { recursive: true });

  const notesDir = path.join(project.root, "notes");
  await fs.mkdir(notesDir, { recursive: true });

  await fs.writeFile(
    path.join(notesDir, "bundle-note.md"),
    `---
id: 20260418125959
title: Bundle Note
tags: []
target: current
---

This bundle note keeps enough routing words today.
`,
    "utf8",
  );

  for (let index = 0; index < noteContents.length; index += 1) {
    const noteContent = noteContents[index];
    if (noteContent === undefined) {
      throw new Error(`Missing note content for index ${index}`);
    }
    await fs.writeFile(
      path.join(notesDir, `note-${index + 1}.md`),
      noteContent,
      "utf8",
    );
  }

  return { root: project.root, bundleDir };
}

describe("runValidateCommand", () => {
  test("prints note validation passed when source notes are valid", async () => {
    const { bundleDir } = await createBundleFixture([
      `---
id: 20260418120000
title: Valid Note
tags: []
target: current
---

This valid note keeps enough routing words today.
`,
    ]);

    const capture = createBufferedCommandIo();
    const exitCode = await runValidateCommand({ bundleDir }, capture.io);

    expect(exitCode).toBe(0);
    expect(capture.logs()).toContain("Note validation passed");
  });

  test("reports duplicate note IDs from source notes", async () => {
    const { bundleDir } = await createBundleFixture([
      `---
id: 20260418120001
title: Duplicate One
tags: []
target: current
---

This duplicate note keeps enough routing words today.
`,
      `---
id: 20260418120001
title: Duplicate Two
tags: []
target: current
---

This duplicate note keeps enough routing words today.
`,
    ]);

    const capture = createBufferedCommandIo();
    let exitCode = 0;
    try {
      await runValidateCommand({ bundleDir }, capture.io);
    } catch {
      exitCode = 10;
    }

    expect(exitCode).toBe(10);
    expect(capture.logs()).toContain("Duplicate note IDs detected");
    expect(capture.logs()).toContain("20260418120001");
  });

  test("writes JSON output when requested", async () => {
    const { bundleDir } = await createBundleFixture([
      `---
id: 20260418120002
title: Json Note
tags: []
target: current
---

This JSON note keeps enough routing words today.
`,
    ]);

    const capture = createBufferedCommandIo();
    const exitCode = await runValidateCommand(
      { bundleDir, json: true },
      capture.io,
    );
    const parsedJson = parseJsonOutput<{
      bundleDir: string;
      notes: { count: number; valid: boolean };
      valid: boolean;
    }>(capture.stdout());

    expect(exitCode).toBe(0);
    expect(parsedJson.valid).toBe(true);
    expect(parsedJson.notes).toEqual({
      count: 2,
      valid: true,
    });
    expect(parsedJson.bundleDir).toBe(bundleDir);
  });

  test("returns 0 without printing a note summary when no notes exist", async () => {
    const { root, bundleDir } = await createBundleFixture([]);
    await fs.rm(path.join(root, "notes"), { recursive: true, force: true });

    const capture = createBufferedCommandIo();
    const exitCode = await runValidateCommand({ bundleDir }, capture.io);

    expect(exitCode).toBe(0);
    expect(capture.logs()).toBe("");
  });
});
