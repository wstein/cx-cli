// test-lane: integration
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
      // Replace time values and consume any trailing padEnd spaces (but not
      // the two-space column separator) so the status column always aligns
      // regardless of mtimeWidth at test-run time.
      .replace(/\bjust now *(?= {2})/g, "<RELATIVE_TIME>")
      .replace(/\b\d+m ago *(?= {2})/g, "<RELATIVE_TIME>")
      .replace(/\b\d+h ago *(?= {2})/g, "<RELATIVE_TIME>")
      .replace(/\b\d+d ago *(?= {2})/g, "<RELATIVE_TIME>")
      .replace(/\b\d{4}-\d{2}-\d{2} *(?= {2})/g, "<RELATIVE_TIME>")
      // Normalize the header's time column: strip padEnd trailing spaces so
      // the column width is stable across runs.
      .replace(/\btime +(?= {2})/g, "time"),
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
