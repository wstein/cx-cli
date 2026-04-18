import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { main } from "../../src/cli/main.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";

describe("main routing lane", () => {
  test("scaffolds repository notes when init writes files", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-init-"));
    const capture = createBufferedCommandIo({ cwd: root });
    await expect(main(["init", "--name", "demo"], capture.io)).resolves.toBe(0);

    const configSource = await fs.readFile(path.join(root, "cx.toml"), "utf8");
    const notesGuide = await fs.readFile(
      path.join(root, "notes", "README.md"),
      "utf8",
    );
    expect(configSource).toContain('project_name = "demo"');
    expect(notesGuide).toContain("# Repository Notes Guide");
  });

  test("force init refreshes generated notes files", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-init-force-"));
    const capture = createBufferedCommandIo({ cwd: root });
    await expect(main(["init", "--name", "demo"], capture.io)).resolves.toBe(0);
    await fs.writeFile(
      path.join(root, "notes", "README.md"),
      "custom guide\n",
      "utf8",
    );
    await expect(
      main(["init", "--name", "demo", "--force"], capture.io),
    ).resolves.toBe(0);

    const refreshedGuide = await fs.readFile(
      path.join(root, "notes", "README.md"),
      "utf8",
    );
    expect(refreshedGuide).toContain("# Repository Notes Guide");
    expect(refreshedGuide).not.toBe("custom guide\n");
  });

  test("rejects invalid init names", async () => {
    await expect(
      main(["init", "--stdout", "--name", 'demo"broken']),
    ).rejects.toThrow(
      "project_name must be filesystem-safe and use only letters, numbers, dot, underscore, or hyphen.",
    );
  });
});
