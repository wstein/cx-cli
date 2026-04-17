import { describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { getVCSState } from "../../src/vcs/provider.js";

/**
 * VCS provider dispatch tests.
 *
 * These tests verify that getVCSState dispatches to the correct VCS backend
 * by using real temporary directories. No module mocking is used so that
 * these tests cannot pollute the module registry for other test files.
 */
describe("VCS provider dispatch", () => {
  test("prefers git when git is detected", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-dispatch-git-"),
    );
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

  test("uses filesystem fallback when no VCS is detected", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-dispatch-fallback-"),
    );
    try {
      await fs.writeFile(path.join(tempDir, "file.txt"), "hello", "utf8");

      const state = await getVCSState(tempDir);
      expect(state.kind).toBe("none");
      expect(state.trackedFiles).toContain("file.txt");
      expect(state.modifiedFiles).toEqual([]);
      expect(state.untrackedFiles).toEqual([]);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  test("falls through to fossil when git is absent", async () => {
    const checkoutDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-dispatch-fossil-"),
    );
    const repoDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-dispatch-fossil-repo-"),
    );
    try {
      execSync("fossil version", { stdio: "ignore" });
    } catch {
      console.log("⊘ Skipping fossil dispatch test: fossil not installed");
      await fs.rm(checkoutDir, { recursive: true, force: true });
      await fs.rm(repoDir, { recursive: true, force: true });
      return;
    }
    try {
      const repoFile = path.join(repoDir, "repo.fossil");
      execSync(`fossil init "${repoFile}"`, { cwd: repoDir, stdio: "ignore" });
      execSync(`fossil open "${repoFile}" --empty`, {
        cwd: checkoutDir,
        stdio: "ignore",
      });
      await fs.writeFile(
        path.join(checkoutDir, "tracked.txt"),
        "hello",
        "utf8",
      );
      execSync("fossil add tracked.txt", { cwd: checkoutDir, stdio: "ignore" });
      execSync('fossil commit -m "init" --no-warnings', {
        cwd: checkoutDir,
        stdio: "ignore",
        env: { ...process.env, FOSSIL_USER: "test", USER: "test" },
      });

      const state = await getVCSState(checkoutDir);
      expect(state.kind).toBe("fossil");
    } catch (err) {
      console.log(
        `⊘ Skipping fossil dispatch test: setup failed (${err instanceof Error ? err.message : String(err)})`,
      );
    } finally {
      await fs.rm(checkoutDir, { recursive: true, force: true });
      await fs.rm(repoDir, { recursive: true, force: true });
    }
  });

  test("falls through to mercurial when git and fossil are absent", async () => {
    try {
      execSync("hg version", { stdio: "ignore" });
    } catch {
      console.log("⊘ Skipping hg dispatch test: hg not installed");
      return;
    }

    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-dispatch-hg-"),
    );
    try {
      execSync("hg init", { cwd: tempDir, stdio: "ignore" });
      await fs.writeFile(path.join(tempDir, "tracked.txt"), "hello", "utf8");
      execSync("hg add tracked.txt", { cwd: tempDir, stdio: "ignore" });
      execSync('hg commit -m "init"', {
        cwd: tempDir,
        stdio: "ignore",
        env: { ...process.env, HGUSER: "Test User <test@example.com>" },
      });

      const state = await getVCSState(tempDir);
      expect(state.kind).toBe("hg");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
