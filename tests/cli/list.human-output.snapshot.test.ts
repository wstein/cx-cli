import { describe, expect, test } from "bun:test";
import path from "node:path";
import { runBundleCommand } from "../../src/cli/commands/bundle.js";
import { main } from "../../src/cli/main.js";
import { createProject } from "../bundle/helpers.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";
import { assertTextSnapshot } from "../helpers/snapshot/assertSnapshot.js";
import { scrubTextSnapshot } from "../helpers/snapshot/scrubbers.js";

const ANSI_ESCAPE_PATTERN = new RegExp(
  `${String.fromCharCode(27)}\\[[0-9;]*m`,
  "g",
);

function scrubListSnapshot(output: string): string {
  return scrubTextSnapshot(
    output
      .replace(ANSI_ESCAPE_PATTERN, "")
      .replace(/\bjust now\b/g, "<RELATIVE_TIME>")
      .replace(/\b\d+m ago\b/g, "<RELATIVE_TIME>")
      .replace(/\b\d+h ago\b/g, "<RELATIVE_TIME>")
      .replace(/\b\d+d ago\b/g, "<RELATIVE_TIME>"),
  );
}

describe("list human snapshot lane", () => {
  test("cx list surfaces provenance suffixes", async () => {
    const project = await createProject({ includeLinkedNotes: true });
    expect(await runBundleCommand({ config: project.configPath })).toBe(0);

    const capture = createBufferedCommandIo({ cwd: project.root });
    const exitCode = await main(["list", "dist/demo-bundle"], capture.io);
    expect(exitCode).toBe(0);

    const scrubbed = scrubListSnapshot(capture.stdout());
    await assertTextSnapshot({
      snapshotPath: path.join(
        process.cwd(),
        "tests/fixtures/snapshots/cli/list-provenance-human.txt",
      ),
      actual: scrubbed,
    });
  });
});
