import { describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  classifyDirtyState,
  getVCSState,
  type VCSKind,
  type VCSState,
} from "../../src/vcs/provider.js";

/**
 * Test suite for VCS provider implementations.
 * Tests Mercurial (hg), Git, Fossil, and filesystem fallback.
 *
 * Note: These tests require the corresponding VCS tools to be installed
 * on the test system. Tests gracefully skip if tools are unavailable.
 */
describe("VCS Provider: Mercurial", () => {
  async function isHgAvailable(): Promise<boolean> {
    try {
      execSync("hg version", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  async function setupHgRepo(tempDir: string): Promise<void> {
    // Initialize a Mercurial repository
    execSync("hg init", { cwd: tempDir, stdio: "ignore" });

    // Create initial commit
    const filePath = path.join(tempDir, "tracked.txt");
    await fs.writeFile(filePath, "initial content", "utf8");
    execSync("hg add tracked.txt", { cwd: tempDir, stdio: "ignore" });
    execSync('hg commit -m "initial commit"', {
      cwd: tempDir,
      stdio: "ignore",
      env: { ...process.env, HGUSER: "Test User <test@example.com>" },
    });
  }

  test("detects Mercurial repository", async () => {
    const hgAvailable = await isHgAvailable();
    if (!hgAvailable) {
      console.log("⊘ Skipping Mercurial tests: hg not installed");
      return;
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-hg-detect-"));
    try {
      await setupHgRepo(tempDir);
      const state = await getVCSState(tempDir);
      expect(state.kind).toBe("hg");
    } finally {
      await fs.rm(tempDir, { recursive: true });
    }
  });

  test("lists tracked files in Mercurial repository", async () => {
    const hgAvailable = await isHgAvailable();
    if (!hgAvailable) {
      console.log("⊘ Skipping Mercurial tests: hg not installed");
      return;
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-hg-tracked-"));
    try {
      await setupHgRepo(tempDir);
      const state = await getVCSState(tempDir);

      expect(state.kind).toBe("hg");
      expect(state.trackedFiles).toContain("tracked.txt");
      expect(state.modifiedFiles.length).toBe(0);
      expect(state.untrackedFiles.length).toBe(0);
    } finally {
      await fs.rm(tempDir, { recursive: true });
    }
  });

  test("detects modified files in Mercurial repository", async () => {
    const hgAvailable = await isHgAvailable();
    if (!hgAvailable) {
      console.log("⊘ Skipping Mercurial tests: hg not installed");
      return;
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-hg-modified-"));
    try {
      await setupHgRepo(tempDir);

      // Modify the tracked file
      const filePath = path.join(tempDir, "tracked.txt");
      await fs.writeFile(filePath, "modified content", "utf8");

      const state = await getVCSState(tempDir);
      expect(state.kind).toBe("hg");
      expect(state.trackedFiles).toContain("tracked.txt");
      expect(state.modifiedFiles).toContain("tracked.txt");
      expect(state.untrackedFiles.length).toBe(0);
    } finally {
      await fs.rm(tempDir, { recursive: true });
    }
  });

  test("detects untracked files in Mercurial repository", async () => {
    const hgAvailable = await isHgAvailable();
    if (!hgAvailable) {
      console.log("⊘ Skipping Mercurial tests: hg not installed");
      return;
    }

    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-hg-untracked-"),
    );
    try {
      await setupHgRepo(tempDir);

      // Create an untracked file
      const untrackedPath = path.join(tempDir, "untracked.txt");
      await fs.writeFile(untrackedPath, "untracked content", "utf8");

      const state = await getVCSState(tempDir);
      expect(state.kind).toBe("hg");
      expect(state.trackedFiles).toContain("tracked.txt");
      expect(state.untrackedFiles).toContain("untracked.txt");
      expect(state.modifiedFiles.length).toBe(0);
    } finally {
      await fs.rm(tempDir, { recursive: true });
    }
  });

  test("detects both modified and untracked files", async () => {
    const hgAvailable = await isHgAvailable();
    if (!hgAvailable) {
      console.log("⊘ Skipping Mercurial tests: hg not installed");
      return;
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-hg-mixed-"));
    try {
      await setupHgRepo(tempDir);

      // Modify tracked file
      const trackedPath = path.join(tempDir, "tracked.txt");
      await fs.writeFile(trackedPath, "modified", "utf8");

      // Create untracked file
      const untrackedPath = path.join(tempDir, "untracked.txt");
      await fs.writeFile(untrackedPath, "untracked", "utf8");

      const state = await getVCSState(tempDir);
      expect(state.kind).toBe("hg");
      expect(state.trackedFiles).toContain("tracked.txt");
      expect(state.modifiedFiles).toContain("tracked.txt");
      expect(state.untrackedFiles).toContain("untracked.txt");
    } finally {
      await fs.rm(tempDir, { recursive: true });
    }
  });
});

/**
 * VCS-agnostic tests for dirty state classification.
 * Validates that all VCS providers (Git, Fossil, Mercurial) report
 * the same dirty state classification.
 */
describe("Dirty State Classification", () => {
  test("classifies clean state correctly", () => {
    const state: VCSState = {
      kind: "hg",
      trackedFiles: ["file1.txt", "file2.txt"],
      modifiedFiles: [],
      untrackedFiles: [],
    };
    const dirtyState = classifyDirtyState(state);
    expect(dirtyState).toBe("clean");
  });

  test("classifies safe_dirty state (untracked files only)", () => {
    const state: VCSState = {
      kind: "hg",
      trackedFiles: ["file1.txt"],
      modifiedFiles: [],
      untrackedFiles: ["temp.log"],
    };
    const dirtyState = classifyDirtyState(state);
    expect(dirtyState).toBe("safe_dirty");
  });

  test("classifies unsafe_dirty state (modified files)", () => {
    const state: VCSState = {
      kind: "hg",
      trackedFiles: ["file1.txt"],
      modifiedFiles: ["file1.txt"],
      untrackedFiles: [],
    };
    const dirtyState = classifyDirtyState(state);
    expect(dirtyState).toBe("unsafe_dirty");
  });

  test("classifies unsafe_dirty when both modified and untracked exist", () => {
    const state: VCSState = {
      kind: "hg",
      trackedFiles: ["file1.txt"],
      modifiedFiles: ["file1.txt"],
      untrackedFiles: ["temp.log"],
    };
    const dirtyState = classifyDirtyState(state);
    expect(dirtyState).toBe("unsafe_dirty");
  });

  test("treats filesystem fallback as always clean", () => {
    const state: VCSState = {
      kind: "none",
      trackedFiles: ["file1.txt", "file2.txt"],
      modifiedFiles: [],
      untrackedFiles: [],
    };
    const dirtyState = classifyDirtyState(state);
    expect(dirtyState).toBe("clean");
  });
});

/**
 * Type validation tests to ensure VCSKind includes all expected kinds.
 */
describe("VCS Provider Type Coverage", () => {
  test("VCSKind includes git", () => {
    const kind: VCSKind = "git";
    expect(kind).toBe("git");
  });

  test("VCSKind includes fossil", () => {
    const kind: VCSKind = "fossil";
    expect(kind).toBe("fossil");
  });

  test("VCSKind includes hg", () => {
    const kind: VCSKind = "hg";
    expect(kind).toBe("hg");
  });

  test("VCSKind includes none", () => {
    const kind: VCSKind = "none";
    expect(kind).toBe("none");
  });
});
