// test-lane: unit
import { describe, expect, test } from "bun:test";

import { detectHg, getHgState } from "../../src/vcs/mercurial.js";

describe("Mercurial VCS helpers", () => {
  test("detectHg returns true when identify succeeds", async () => {
    const run = async (args: string[], cwd: string) => {
      expect(args).toEqual(["identify"]);
      expect(cwd).toBe("/repo");
      return { stdout: "abcd1234\n" };
    };

    await expect(detectHg("/repo", run)).resolves.toBe(true);
  });

  test("detectHg returns false when identify fails", async () => {
    const run = async () => {
      throw new Error("not a mercurial repository");
    };

    await expect(detectHg("/repo", run)).resolves.toBe(false);
  });

  test("getHgState parses tracked, modified, untracked, ignored, and clean files", async () => {
    const run = async (args: string[]) => {
      if (args[0] === "files") {
        return { stdout: "zeta.txt\nalpha.txt\nnested/path.md\n" };
      }

      if (args[0] === "status") {
        return {
          stdout: [
            "M modified.txt",
            "? stray.txt",
            "I ignored.txt",
            "C clean.txt",
            "! missing.txt",
            "M  ",
            "",
          ].join("\n"),
        };
      }

      throw new Error(`unexpected hg command: ${args.join(" ")}`);
    };

    const state = await getHgState("/repo", run);

    expect(state.kind).toBe("hg");
    expect(state.trackedFiles).toEqual([
      "alpha.txt",
      "nested/path.md",
      "zeta.txt",
    ]);
    expect(state.modifiedFiles).toEqual(["missing.txt", "modified.txt"]);
    expect(state.untrackedFiles).toEqual(["stray.txt"]);
  });

  test("getHgState tolerates status command failure", async () => {
    const run = async (args: string[]) => {
      if (args[0] === "files") {
        return { stdout: "tracked.txt\n" };
      }

      throw new Error("status unavailable");
    };

    const state = await getHgState("/repo", run);

    expect(state.trackedFiles).toEqual(["tracked.txt"]);
    expect(state.modifiedFiles).toEqual([]);
    expect(state.untrackedFiles).toEqual([]);
  });
});
