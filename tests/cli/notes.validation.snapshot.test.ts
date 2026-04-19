// test-lane: integration
import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { main } from "../../src/cli/main.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";
import { assertTextSnapshot } from "../helpers/snapshot/assertSnapshot.js";
import { scrubTextSnapshot } from "../helpers/snapshot/scrubbers.js";

const ANSI_ESCAPE_PATTERN = new RegExp(
  `${String.fromCharCode(27)}\\[[0-9;]*m`,
  "g",
);

function scrubNotesValidationSnapshot(output: string, rootDir: string): string {
  return scrubTextSnapshot(
    output.replace(ANSI_ESCAPE_PATTERN, "").replace(/\nℹ\s*$/u, ""),
    {
      rootDir,
    },
  );
}

describe("notes validation human snapshot lane", () => {
  test("cx notes check surfaces governance failures clearly", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-notes-snapshot-"));
    await fs.mkdir(path.join(root, "notes"), { recursive: true });
    await fs.writeFile(
      path.join(root, "notes", "Invalid Note.md"),
      `---
id: 20260419170000
aliases: []
tags: []
---

## Links

- [[Missing Summary]]
`,
      "utf8",
    );

    const capture = createBufferedCommandIo({ cwd: root });
    const exitCode = await main(["notes", "check"], capture.io);
    expect(exitCode).toBe(1);

    const output = [capture.logs(), capture.stdout(), capture.stderr()]
      .filter((chunk) => chunk.length > 0)
      .join("\n");
    const scrubbed = scrubNotesValidationSnapshot(output, root);

    await assertTextSnapshot({
      snapshotPath: path.join(
        process.cwd(),
        "tests/fixtures/snapshots/cli/notes-check-governance-failure-human.txt",
      ),
      actual: scrubbed,
    });
  });
});
