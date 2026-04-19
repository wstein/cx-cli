// test-lane: integration

import path from "node:path";
import { describe, expect, test } from "vitest";
import { main } from "../../src/cli/main.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";
import { assertTextSnapshot } from "../helpers/snapshot/assertSnapshot.js";
import { scrubTextSnapshot } from "../helpers/snapshot/scrubbers.js";

describe("mcp catalog human snapshot lane", () => {
  test("mcp catalog human output snapshot", async () => {
    const capture = createBufferedCommandIo();
    const exitCode = await main(["mcp", "catalog"], capture.io);
    expect(exitCode).toBe(0);

    const scrubbed = scrubTextSnapshot(capture.stdout());
    await assertTextSnapshot({
      snapshotPath: path.join(
        process.cwd(),
        "tests/fixtures/snapshots/cli/mcp-catalog-human.txt",
      ),
      actual: scrubbed,
    });
  });
});
