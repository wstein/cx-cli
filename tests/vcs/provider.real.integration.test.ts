import { describe, expect, test } from "bun:test";
import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getVCSState } from "../../src/vcs/provider.js";

const RUN_REAL_VCS = process.env.CX_RUN_REAL_VCS === "1";

function hasBinary(name: string): boolean {
  const result = spawnSync(name, ["--version"], { stdio: "ignore" });
  return result.status === 0;
}

describe("VCS provider real integration", () => {
  const realTest = RUN_REAL_VCS ? test : test.skip;
  const realHgTest = RUN_REAL_VCS && hasBinary("hg") ? test : test.skip;
  const realFossilTest = RUN_REAL_VCS && hasBinary("fossil") ? test : test.skip;

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

  realHgTest("detects mercurial repository state", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-hg-real-"));
    try {
      execSync("hg init", { cwd: tempDir, stdio: "ignore" });
      await fs.writeFile(path.join(tempDir, "tracked.txt"), "hello", "utf8");
      execSync("hg add tracked.txt", { cwd: tempDir, stdio: "ignore" });
      execSync("hg commit -m init -u test", { cwd: tempDir, stdio: "ignore" });

      const state = await getVCSState(tempDir);
      expect(state.kind).toBe("hg");
      expect(state.trackedFiles).toContain("tracked.txt");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  realFossilTest("detects fossil repository state", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-fossil-real-"));
    const repoPath = path.join(tempDir, "repo.fossil");
    const checkoutDir = path.join(tempDir, "checkout");
    await fs.mkdir(checkoutDir, { recursive: true });

    try {
      execSync(`fossil init ${repoPath}`, { cwd: tempDir, stdio: "ignore" });
      execSync(`fossil open ${repoPath}`, { cwd: checkoutDir, stdio: "ignore" });

      await fs.writeFile(path.join(checkoutDir, "tracked.txt"), "hello", "utf8");
      execSync("fossil add tracked.txt", { cwd: checkoutDir, stdio: "ignore" });
      execSync('fossil commit -m "init" --user test', {
        cwd: checkoutDir,
        stdio: "ignore",
      });

      const state = await getVCSState(checkoutDir);
      expect(state.kind).toBe("fossil");
      expect(state.trackedFiles).toContain("tracked.txt");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});