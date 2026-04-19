// test-lane: integration

import path from "node:path";
import { describe, expect, test } from "vitest";
import packageJson from "../../package.json" with { type: "json" };
import { main } from "../../src/cli/main.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";
import { assertTextSnapshot } from "../helpers/snapshot/assertSnapshot.js";
import { scrubTextSnapshot } from "../helpers/snapshot/scrubbers.js";

describe("main human snapshot lane", () => {
  test("top-level help snapshot", async () => {
    const capture = createBufferedCommandIo();
    const exitCode = await main([], capture.io);
    expect(exitCode).toBe(0);
    const scrubbed = scrubTextSnapshot(capture.stdout(), {
      stripVersions: true,
    });
    await assertTextSnapshot({
      snapshotPath: path.join(
        process.cwd(),
        "tests/fixtures/snapshots/cli/main-help-human.txt",
      ),
      actual: scrubbed,
    });
  });

  test("init stdout snapshot", async () => {
    const capture = createBufferedCommandIo();
    const exitCode = await main(["init", "--stdout"], capture.io);
    expect(exitCode).toBe(0);
    const scrubbed = scrubTextSnapshot(capture.stdout());
    await assertTextSnapshot({
      snapshotPath: path.join(
        process.cwd(),
        "tests/fixtures/snapshots/cli/main-init-stdout-human.txt",
      ),
      actual: scrubbed,
    });
  });

  test("prints CLI version", async () => {
    const capture = createBufferedCommandIo();
    const exitCode = await main(["--version"], capture.io);
    expect(exitCode).toBe(0);
    expect(capture.stdout().trim()).toBe(packageJson.version);
  });
});
