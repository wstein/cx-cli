// test-lane: integration
import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolveMcpConfigPath } from "../../src/cli/commands/mcp.js";
import { assertTextSnapshot } from "../helpers/snapshot/assertSnapshot.js";
import { scrubTextSnapshot } from "../helpers/snapshot/scrubbers.js";

describe("mcp human snapshot lane", () => {
  test("missing profile error snapshot", async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-mcp-missing-human-"),
    );
    let message = "";
    try {
      await resolveMcpConfigPath(root);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain("Unable to start cx mcp");
    const scrubbed = scrubTextSnapshot(`${message}\n`, { rootDir: root });
    await assertTextSnapshot({
      snapshotPath: path.join(
        process.cwd(),
        "tests/fixtures/snapshots/cli/mcp-missing-profile-human.txt",
      ),
      actual: scrubbed,
    });
  });
});
