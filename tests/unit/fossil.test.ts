// test-lane: unit
import { describe, expect, test } from "vitest";

import {
  detectFossil,
  getFossilState,
  getRecentFossilHistory,
} from "../../src/vcs/fossil.js";

describe("Fossil VCS helpers", () => {
  test("detectFossil returns true when ls succeeds", async () => {
    const run = async (args: string[], cwd: string) => {
      expect(args).toEqual(["ls"]);
      expect(cwd).toBe("/repo");
      return { stdout: "tracked.txt\n" };
    };

    await expect(detectFossil("/repo", run)).resolves.toBe(true);
  });

  test("detectFossil returns false when ls fails", async () => {
    const run = async () => {
      throw new Error("not a fossil checkout");
    };

    await expect(detectFossil("/repo", run)).resolves.toBe(false);
  });

  test("getFossilState parses tracked, modified, and untracked files", async () => {
    const run = async (args: string[]) => {
      if (args[0] === "ls") {
        return {
          stdout: "zeta.txt\nalpha.txt\nnested/path.md\n",
        };
      }

      if (args[0] === "status") {
        return {
          stdout: [
            "UNCHANGED alpha.txt",
            "EDITED nested/path.md",
            "EXTRA stray.txt",
            "MALFORMED",
            "MISSING beta.txt",
          ].join("\n"),
        };
      }

      throw new Error(`unexpected fossil command: ${args.join(" ")}`);
    };

    const state = await getFossilState("/repo", run);

    expect(state.kind).toBe("fossil");
    expect(state.trackedFiles).toEqual([
      "alpha.txt",
      "nested/path.md",
      "zeta.txt",
    ]);
    expect(state.modifiedFiles).toEqual(["beta.txt", "nested/path.md"]);
    expect(state.untrackedFiles).toEqual(["stray.txt"]);
  });

  test("getFossilState tolerates status command failure", async () => {
    const run = async (args: string[]) => {
      if (args[0] === "ls") {
        return { stdout: "tracked.txt\n" };
      }

      throw new Error("status unavailable");
    };

    const state = await getFossilState("/repo", run);

    expect(state.trackedFiles).toEqual(["tracked.txt"]);
    expect(state.modifiedFiles).toEqual([]);
    expect(state.untrackedFiles).toEqual([]);
  });

  test("getRecentFossilHistory parses bounded subject-only history", async () => {
    const run = async (args: string[]) => {
      if (args[0] === "sql") {
        return {
          stdout: [
            "aaaaaaaaaaaa1111111111111111111111111111\tAdd handover history",
            "bbbbbbbbbbbb2222222222222222222222222222\tTighten contract tests",
          ].join("\n"),
        };
      }
      throw new Error(`unexpected fossil command: ${args.join(" ")}`);
    };

    const history = await getRecentFossilHistory("/repo", 2, run);

    expect(history).toEqual([
      {
        hash: "aaaaaaaaaaaa1111111111111111111111111111",
        shortHash: "aaaaaaaaaaaa",
        subject: "Add handover history",
      },
      {
        hash: "bbbbbbbbbbbb2222222222222222222222222222",
        shortHash: "bbbbbbbbbbbb",
        subject: "Tighten contract tests",
      },
    ]);
  });
});
