// test-lane: unit
import { describe, expect, test } from "vitest";

describe("Git exec wrapper", () => {
  test("detectGit and getGitState use the expected git options", async () => {
    const calls: Array<{
      args: string[];
      cwd: string;
    }> = [];
    const { detectGit, getGitState } = await import("../../src/vcs/git.js");

    const run = async (args: string[], cwd: string) => {
      calls.push({ args, cwd });
      if (args[0] === "rev-parse") {
        return { stdout: ".git\n" };
      }

      if (args[0] === "ls-files") {
        return { stdout: "zeta.txt\0alpha.txt\0" };
      }

      return { stdout: " M modified.txt\n?? stray.txt\n" };
    };

    await expect(detectGit("/repo", run)).resolves.toBe(true);
    const state = await getGitState("/repo", run);

    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(call.cwd).toBe("/repo");
    }
    expect(state.trackedFiles).toEqual(["alpha.txt", "zeta.txt"]);
    expect(state.modifiedFiles).toEqual(["modified.txt"]);
    expect(state.untrackedFiles).toEqual(["stray.txt"]);
  });

  test("detectGit returns true for real git repo using default runner", async () => {
    const { detectGit } = await import("../../src/vcs/git.js");
    const result = await detectGit(process.cwd());
    expect(result).toBe(true);
  });

  test("detectGit returns false for non-git directory using default runner", async () => {
    const { detectGit } = await import("../../src/vcs/git.js");
    const result = await detectGit("/tmp");
    expect(result).toBe(false);
  });
});
