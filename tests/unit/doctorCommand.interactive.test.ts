// test-lane: unit

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, test, vi } from "vitest";
import { captureCli } from "../helpers/cli/captureCli.js";

const execFileAsync = promisify(execFile);

async function initGitRepo(root: string): Promise<void> {
  await execFileAsync("git", ["init", "-q"], { cwd: root });
  await execFileAsync("git", ["config", "user.email", "cx@example.com"], {
    cwd: root,
  });
  await execFileAsync("git", ["config", "user.name", "cx"], { cwd: root });
  await execFileAsync("git", ["add", "."], { cwd: root });
  await execFileAsync("git", ["commit", "-q", "-m", "init"], {
    cwd: root,
  });
}

async function createOverlapProject(): Promise<{
  root: string;
  configPath: string;
}> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "cx-doctor-interactive-"),
  );
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.writeFile(
    path.join(root, "src", "index.ts"),
    "export const value = 1;\n",
    "utf8",
  );

  const configPath = path.join(root, "cx.toml");
  await fs.writeFile(
    configPath,
    `schema_version = 1
project_name = "demo"
source_root = "."
output_dir = "dist/demo-bundle"

[repomix]
style = "xml"
show_line_numbers = false
include_empty_directories = false
security_check = false

[files]
exclude = ["dist/**"]
follow_symlinks = false
unmatched = "ignore"

[sections.src]
include = ["src/**"]
exclude = []

[sections.mixed]
include = ["src/**"]
`,
    "utf8",
  );
  await initGitRepo(root);
  return { root, configPath };
}

function installInquirerMock(owner: string): {
  selectMock: ReturnType<typeof vi.fn>;
} {
  const selectMock = vi.fn(async () => owner);
  vi.doMock("@inquirer/prompts", () => ({
    input: vi.fn(async () => "unused"),
    select: selectMock,
    confirm: vi.fn(async () => true),
    checkbox: vi.fn(async () => []),
  }));
  return { selectMock };
}

describe("runDoctorCommand coverage helpers", () => {
  afterEach(() => {
    vi.doUnmock("@inquirer/prompts");
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  test("fix-overlaps interactive path updates the config", async () => {
    const project = await createOverlapProject();
    const { selectMock } = installInquirerMock("mixed");
    const originalCwd = process.cwd();
    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", {
      configurable: true,
      value: true,
    });
    process.chdir(project.root);

    let result: Awaited<ReturnType<typeof captureCli>>;
    try {
      const { main } = await import("../../src/cli/main.js");
      result = await captureCli({
        run: () =>
          main([
            "doctor",
            "fix-overlaps",
            "--interactive",
            "--config",
            project.configPath,
          ]),
        captureConsoleLog: true,
      });
    } finally {
      Object.defineProperty(process.stdin, "isTTY", {
        configurable: true,
        value: originalIsTTY,
      });
      process.chdir(originalCwd);
    }
    expect(result.exitCode).toBe(0);

    const updatedConfig = await fs.readFile(project.configPath, "utf8");
    expect(updatedConfig).toContain(
      '[sections.src]\ninclude = ["src/**"]\nexclude = ["src/index.ts"]',
    );
    expect(`${result.logs}\n${result.stdout}`).toContain("Overlap Resolution");
    expect(`${result.logs}\n${result.stdout}`).toContain(
      "Overlap resolution complete",
    );
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(String(selectMock.mock.calls[0]?.[0]?.message)).toContain(
      "Which section should own src/index.ts?",
    );
  }, 15_000);

  test("doctor --all returns the overlap exit code when conflicts exist", async () => {
    const project = await createOverlapProject();
    const { main } = await import("../../src/cli/main.js");

    await expect(
      main(["doctor", "--all", "--config", project.configPath]),
    ).resolves.toBe(4);
  });
});
