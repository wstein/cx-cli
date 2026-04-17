import { describe, expect, test } from "bun:test";

describe("Fossil exec wrapper", () => {
  test("detectFossil and getFossilState shell out with the expected options", async () => {
    const calls: Array<{
      args: string[];
      cwd: string;
    }> = [];
    const { detectFossil, getFossilState } = await import(
      "../../src/vcs/fossil.js"
    );

    const run = async (args: string[], cwd: string) => {
      calls.push({ args, cwd });
      if (args[0] === "ls") {
        return { stdout: "zeta.txt\nalpha.txt\n" };
      }

      return { stdout: "EXTRA stray.txt\nEDITED modified.txt\n" };
    };

    await expect(detectFossil("/repo", run)).resolves.toBe(true);
    const state = await getFossilState("/repo", run);

    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(call.cwd).toBe("/repo");
    }
    expect(state.trackedFiles).toEqual(["alpha.txt", "zeta.txt"]);
    expect(state.modifiedFiles).toEqual(["modified.txt"]);
    expect(state.untrackedFiles).toEqual(["stray.txt"]);
  });
});
