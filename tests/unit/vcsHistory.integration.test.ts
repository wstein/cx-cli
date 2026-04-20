// test-lane: unit

import { execFile, execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";

import { getRecentFossilHistory } from "../../src/vcs/fossil.js";
import { getRecentHgHistory } from "../../src/vcs/mercurial.js";

const execFileAsync = promisify(execFile);

function hasCommand(binary: string): boolean {
  try {
    execFileSync("which", [binary], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const hasHg = hasCommand("hg");
const hasFossil = hasCommand("fossil");

describe("real vcs history fixtures", () => {
  const hgTest = hasHg ? test : test.skip;
  const fossilTest = hasFossil ? test : test.skip;

  hgTest("mercurial history preserves multiline commit messages", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-hg-history-"));

    await execFileAsync("hg", ["init"], { cwd: root });
    await fs.writeFile(path.join(root, "README.md"), "hello\n", "utf8");
    await execFileAsync("hg", ["add", "README.md"], { cwd: root });
    await execFileAsync(
      "hg",
      ["commit", "-u", "cx", "-m", "subject line\n\nbody line"],
      { cwd: root },
    );

    const history = await getRecentHgHistory(root, 30);

    expect(history[0]?.shortHash).toHaveLength(12);
    expect(history[0]?.message).toBe("subject line\n\nbody line");
  });

  fossilTest("fossil history preserves multiline commit messages", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-fossil-history-"));
    const home = path.join(root, ".home");
    const config = path.join(root, ".config");
    const work = path.join(root, "work");
    const repo = path.join(root, "repo.fossil");
    await fs.mkdir(home, { recursive: true });
    await fs.mkdir(config, { recursive: true });
    await fs.mkdir(work, { recursive: true });

    const env = {
      ...process.env,
      HOME: home,
      XDG_CONFIG_HOME: config,
      FOSSIL_HOME: home,
    };

    const run = async (args: string[], cwd: string) =>
      execFileAsync("fossil", args, {
        cwd,
        env,
        maxBuffer: 100 * 1024 * 1024,
      });

    await run(["init", repo], root);
    await run(["open", repo], work);
    await fs.writeFile(path.join(work, "README.md"), "hello\n", "utf8");
    await run(["add", "README.md"], work);
    await run(
      ["commit", "-m", "subject line\n\nbody line", "--user-override", "cx"],
      work,
    );

    const history = await getRecentFossilHistory(work, 30, run);

    expect(history[0]?.shortHash).toHaveLength(12);
    expect(history[0]?.message).toBe("subject line\n\nbody line");
  });
});
