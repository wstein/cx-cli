import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runInitCommand } from "../../src/cli/commands/init.js";
import { captureCli } from "../helpers/cli/captureCli.js";

let testDir: string;
let origCwd: string;

const BASE_ARGS = {
  force: false,
  interactive: false,
  stdout: false,
  templateList: false,
  name: "testproject",
  style: "xml" as const,
};

beforeEach(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-init-test-"));
  origCwd = process.cwd();
  process.chdir(testDir);
});

afterEach(async () => {
  process.chdir(origCwd);
  await fs.rm(testDir, { recursive: true, force: true });
});

describe("runInitCommand", () => {
  test("returns 0 and creates files on first run", async () => {
    const { exitCode } = await captureCli({
      run: () => runInitCommand(BASE_ARGS),
    });
    expect(exitCode).toBe(0);
    const cx = await fs.readFile(path.join(testDir, "cx.toml"), "utf8");
    expect(cx).toContain("testproject");
  });

  test("second run without --force prints skip messages", async () => {
    // First run creates files
    await captureCli({ run: () => runInitCommand(BASE_ARGS) });

    // Second run: files already exist, unchanged → "Skipped existing" for each
    // printInfo/printSuccess use console.log, so captureConsoleLog is required
    const { logs } = await captureCli({
      run: () => runInitCommand(BASE_ARGS),
      captureConsoleLog: true,
    });
    expect(logs).toContain("Skipped existing cx.toml");
  });

  test("json=true outputs structured JSON without writing stdout text", async () => {
    const { stdout, exitCode } = await captureCli({
      run: () => runInitCommand({ ...BASE_ARGS, json: true }),
      parseJson: true,
    });
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    expect(parsed.projectName).toBe("testproject");
    expect(parsed.style).toBe("xml");
    expect(parsed.path).toBe("cx.toml");
  });

  test("templateList=true prints available templates and returns 0", async () => {
    const { stdout, exitCode } = await captureCli({
      run: () => runInitCommand({ ...BASE_ARGS, templateList: true }),
    });
    expect(exitCode).toBe(0);
    expect(stdout.length).toBeGreaterThan(0);
  });
});
