// test-lane: unit
import { describe, expect, test } from "vitest";

import { detectGit, getGitState } from "../../src/vcs/git.js";

describe("Git VCS helpers", () => {
  test("detectGit returns true when rev-parse succeeds", async () => {
    const run = async (args: string[], cwd: string) => {
      expect(args).toEqual(["rev-parse", "--git-dir"]);
      expect(cwd).toBe("/repo");
      return { stdout: ".git\n" };
    };

    await expect(detectGit("/repo", run)).resolves.toBe(true);
  });

  test("detectGit returns false when rev-parse fails", async () => {
    const run = async () => {
      throw new Error("not a git repository");
    };

    await expect(detectGit("/repo", run)).resolves.toBe(false);
  });

  test("getGitState parses tracked, modified, and untracked files", async () => {
    const run = async (args: string[]) => {
      if (args[0] === "ls-files") {
        return { stdout: "zeta.txt\0alpha.txt\0nested/path.md\0" };
      }

      if (args[0] === "status") {
        return {
          stdout: [
            " M modified.txt",
            "?? stray.txt",
            "A  nested/path.md",
            " M  ",
            "?? ",
            "",
          ].join("\n"),
        };
      }

      throw new Error(`unexpected git command: ${args.join(" ")}`);
    };

    const state = await getGitState("/repo", run);

    expect(state.kind).toBe("git");
    expect(state.trackedFiles).toEqual([
      "alpha.txt",
      "nested/path.md",
      "zeta.txt",
    ]);
    expect(state.modifiedFiles).toEqual(["modified.txt", "nested/path.md"]);
    expect(state.untrackedFiles).toEqual(["stray.txt"]);
  });
});
