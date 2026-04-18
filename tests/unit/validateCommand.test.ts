import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";

import { runBundleCommand } from "../../src/cli/commands/bundle.js";
import { runValidateCommand } from "../../src/cli/commands/validate.js";
import { createProject } from "../bundle/helpers.js";
import { captureCli } from "../helpers/cli/captureCli.js";

async function createBundleFixture(noteContents: string[]): Promise<{
  root: string;
  bundleDir: string;
}> {
  const project = await createProject();
  const bundleRun = await captureCli({
    run: () => runBundleCommand({ config: project.configPath }),
  });
  expect(bundleRun.exitCode).toBe(0);

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
---

Body.
`,
    "utf8",
  );

  for (let index = 0; index < noteContents.length; index += 1) {
    await fs.writeFile(
      path.join(notesDir, `note-${index + 1}.md`),
      noteContents[index],
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
---

Body.
`,
    ]);

    const result = await captureCli({
      run: () => runValidateCommand({ bundleDir }),
      captureConsoleLog: true,
    });

    expect(result.exitCode).toBe(0);
    expect(result.logs).toContain("Note validation passed");
  });

  test("reports duplicate note IDs from source notes", async () => {
    const { bundleDir } = await createBundleFixture([
      `---
id: 20260418120001
title: Duplicate One
tags: []
---

Body.
`,
      `---
id: 20260418120001
title: Duplicate Two
tags: []
---

Body.
`,
    ]);

    const result = await captureCli({
      run: async () => {
        try {
          await runValidateCommand({ bundleDir });
          return 0;
        } catch {
          return 10;
        }
      },
      captureConsoleLog: true,
    });

    expect(result.exitCode).toBe(10);
    expect(result.logs).toContain("Duplicate note IDs detected");
    expect(result.logs).toContain("20260418120001");
  });

  test("writes JSON output when requested", async () => {
    const { bundleDir } = await createBundleFixture([
      `---
id: 20260418120002
title: Json Note
tags: []
---

Body.
`,
    ]);

    const result = await captureCli({
      run: () => runValidateCommand({ bundleDir, json: true }),
      parseJson: true,
    });

    expect(result.exitCode).toBe(0);
    expect(result.parsedJson?.valid).toBe(true);
    expect(result.parsedJson?.notes).toEqual({
      count: 2,
      valid: true,
    });
    expect(result.parsedJson?.bundleDir).toBe(bundleDir);
  });

  test("returns 0 without printing a note summary when no notes exist", async () => {
    const { root, bundleDir } = await createBundleFixture([]);
    await fs.rm(path.join(root, "notes"), { recursive: true, force: true });

    const result = await captureCli({
      run: () => runValidateCommand({ bundleDir }),
      captureConsoleLog: true,
    });

    expect(result.exitCode).toBe(0);
    expect(result.logs).toBe("");
  });
});
