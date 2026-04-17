import { describe, expect, test } from "bun:test";

describe("Mercurial exec wrapper", () => {
  test("detectHg and getHgState use the expected hg options", async () => {
    const calls: Array<{
      args: string[];
      cwd: string;
    }> = [];
    const { detectHg, getHgState } = await import("../../src/vcs/mercurial.js");

    const run = async (args: string[], cwd: string) => {
      calls.push({ args, cwd });
      if (args[0] === "identify") {
        return { stdout: "abcd1234\n" };
      }

      if (args[0] === "files") {
        return { stdout: "zeta.txt\nalpha.txt\n" };
      }

      return {
        stdout: "? stray.txt\nI ignored.txt\n! missing.txt\nC clean.txt\n",
      };
    };

    await expect(detectHg("/repo", run)).resolves.toBe(true);
    const state = await getHgState("/repo", run);

    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(call.cwd).toBe("/repo");
    }
    expect(state.trackedFiles).toEqual(["alpha.txt", "zeta.txt"]);
    expect(state.modifiedFiles).toEqual(["missing.txt"]);
    expect(state.untrackedFiles).toEqual(["stray.txt"]);
  });
});
