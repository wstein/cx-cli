import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runInitCommand } from "../../src/cli/commands/init.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";
import { parseJsonOutput } from "../helpers/cli/parseJsonOutput.js";

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
    const capture = createBufferedCommandIo();
    const exitCode = await runInitCommand(BASE_ARGS, capture.io);
    expect(exitCode).toBe(0);
    const cx = await fs.readFile(path.join(testDir, "cx.toml"), "utf8");
    expect(cx).toContain("testproject");
  });

  test("second run without --force prints skip messages", async () => {
    await runInitCommand(BASE_ARGS, createBufferedCommandIo().io);

    const capture = createBufferedCommandIo();
    await runInitCommand(BASE_ARGS, capture.io);
    expect(capture.logs()).toContain("Skipped existing cx.toml");
  });

  test("json=true outputs structured JSON without writing stdout text", async () => {
    const capture = createBufferedCommandIo();
    const exitCode = await runInitCommand(
      { ...BASE_ARGS, json: true },
      capture.io,
    );
    expect(exitCode).toBe(0);
    const parsed = parseJsonOutput<Record<string, unknown>>(capture.stdout());
    expect(parsed.projectName).toBe("testproject");
    expect(parsed.style).toBe("xml");
    expect(parsed.path).toBe("cx.toml");
  });

  test("templateList=true prints available templates and returns 0", async () => {
    const capture = createBufferedCommandIo();
    const exitCode = await runInitCommand(
      { ...BASE_ARGS, templateList: true },
      capture.io,
    );
    expect(exitCode).toBe(0);
    expect(capture.stdout().length).toBeGreaterThan(0);
  });

  test("invalid project name throws CxError", async () => {
    await expect(
      runInitCommand(
        { ...BASE_ARGS, name: "../../etc/passwd" },
        createBufferedCommandIo().io,
      ),
    ).rejects.toThrow();
  });

  test("stdout=true + json=true outputs JSON to stdout without writing files", async () => {
    const capture = createBufferedCommandIo();
    const exitCode = await runInitCommand(
      { ...BASE_ARGS, stdout: true, json: true },
      capture.io,
    );
    expect(exitCode).toBe(0);
    const parsed = parseJsonOutput<Record<string, unknown>>(capture.stdout());
    expect(parsed.projectName).toBe("testproject");
    expect(parsed.config).toBeDefined();
    expect(parsed.path).toBeNull();
    const exists = await import("node:fs/promises").then((m) =>
      m
        .access(path.join(testDir, "cx.toml"))
        .then(() => true)
        .catch(() => false),
    );
    expect(exists).toBe(false);
  });

  test("stdout=true without json outputs raw config text", async () => {
    const capture = createBufferedCommandIo();
    const exitCode = await runInitCommand(
      { ...BASE_ARGS, stdout: true },
      capture.io,
    );
    expect(exitCode).toBe(0);
    expect(capture.stdout()).toContain("testproject");
    expect(capture.stdout()).toContain("schema_version");
  });

  test("force=true on second run prints 'Updated' messages", async () => {
    await runInitCommand(BASE_ARGS, createBufferedCommandIo().io);
    const capture = createBufferedCommandIo();
    await runInitCommand({ ...BASE_ARGS, force: true }, capture.io);
    expect(capture.logs()).toContain("Updated cx.toml");
  });
});
