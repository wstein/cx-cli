// test-lane: unit

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { getFilesystemState } from "../../src/vcs/fallback.js";

describe("filesystem VCS fallback", () => {
  test("returns all files as tracked with no dirty state", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-fallback-"));
    try {
      await fs.mkdir(path.join(root, "nested"), { recursive: true });
      await fs.writeFile(path.join(root, "root.txt"), "root", "utf8");
      await fs.writeFile(
        path.join(root, "nested", "child.txt"),
        "child",
        "utf8",
      );

      const state = await getFilesystemState(root);

      expect(state.kind).toBe("none");
      expect(state.trackedFiles).toEqual(["nested/child.txt", "root.txt"]);
      expect(state.modifiedFiles).toEqual([]);
      expect(state.untrackedFiles).toEqual([]);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
