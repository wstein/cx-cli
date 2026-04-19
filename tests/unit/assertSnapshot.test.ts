// test-lane: unit
import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  assertJsonSnapshot,
  assertTextSnapshot,
} from "../helpers/snapshot/assertSnapshot.js";

describe("snapshot assertions", () => {
  test("text snapshot mismatches include a unified diff", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-snapshot-"));
    const snapshotPath = path.join(tempDir, "example.txt");
    await fs.writeFile(snapshotPath, "alpha\nbeta\nomega\n", "utf8");

    await expect(
      assertTextSnapshot({
        snapshotPath,
        actual: "alpha\ngamma\nomega\n",
      }),
    ).rejects.toThrow(
      `Snapshot mismatch at ${snapshotPath}. Set UPDATE_TEST_SNAPSHOTS=1 to accept changes.\n\n--- ${snapshotPath}\n+++ actual\n@@ -1,3 +1,3 @@\n alpha\n-beta\n+gamma\n omega`,
    );
  });

  test("json snapshot mismatches include a unified diff", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-snapshot-"));
    const snapshotPath = path.join(tempDir, "example.json");
    await fs.writeFile(snapshotPath, '{\n  "status": "old"\n}\n', "utf8");

    await expect(
      assertJsonSnapshot({
        snapshotPath,
        actual: { status: "new" },
      }),
    ).rejects.toThrow(
      `--- ${snapshotPath}\n+++ actual\n@@ -1,3 +1,3 @@\n {\n-  "status": "old"\n+  "status": "new"\n }`,
    );
  });
});
