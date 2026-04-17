import { describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getVCSState } from "../../src/vcs/provider.js";

const RUN_REAL_VCS = process.env.CX_RUN_REAL_VCS === "1";

describe("VCS provider real integration", () => {
  const realTest = RUN_REAL_VCS ? test : test.skip;

  realTest("detects git repository state", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-git-real-"));
    try {
      execSync("git init", { cwd: tempDir, stdio: "ignore" });
      execSync("git config user.email test@example.com", {
        cwd: tempDir,
        stdio: "ignore",
      });
      execSync("git config user.name Test", {
        cwd: tempDir,
        stdio: "ignore",
      });
      await fs.writeFile(path.join(tempDir, "tracked.txt"), "hello", "utf8");
      execSync("git add tracked.txt", { cwd: tempDir, stdio: "ignore" });
      execSync('git commit -m "init"', { cwd: tempDir, stdio: "ignore" });

      const state = await getVCSState(tempDir);
      expect(state.kind).toBe("git");
      expect(state.trackedFiles).toContain("tracked.txt");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});