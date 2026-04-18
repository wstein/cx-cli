import { afterEach, describe, expect, mock, test } from "bun:test";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

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

function captureStdout(): { restore: () => void; output: () => string } {
  const write = process.stdout.write;
  const log = console.log;
  let output = "";
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output += String(chunk);
    return true;
  }) as typeof process.stdout.write;
  console.log = ((...args: unknown[]) => {
    output += `${args.map((value) => String(value)).join(" ")}\n`;
  }) as typeof console.log;
  return {
    restore: () => {
      process.stdout.write = write;
      console.log = log;
    },
    output: () => output,
  };
}

function installInquirerMock(owner: string): {
  selectMock: ReturnType<typeof mock>;
} {
  const selectMock = mock(async () => owner);
  mock.module("@inquirer/prompts", () => ({
    input: mock(async () => "unused"),
    select: selectMock,
    confirm: mock(async () => true),
    checkbox: mock(async () => []),
  }));
  return { selectMock };
}

describe("runDoctorCommand coverage helpers", () => {
  afterEach(() => {
    mock.restore();
  });

  test("fix-overlaps interactive path updates the config", async () => {
    const project = await createOverlapProject();
    const { selectMock } = installInquirerMock("mixed");
    const originalCwd = process.cwd();
    process.chdir(project.root);

    const capture = captureStdout();
    try {
      const { main } = await import("../../src/cli/main.js");
      await expect(
        main([
          "doctor",
          "fix-overlaps",
          "--interactive",
          "--config",
          project.configPath,
        ]),
      ).resolves.toBe(0);
    } finally {
      capture.restore();
      process.chdir(originalCwd);
    }

    const updatedConfig = await fs.readFile(project.configPath, "utf8");
    expect(updatedConfig).toContain(
      '[sections.src]\ninclude = ["src/**"]\nexclude = ["src/index.ts"]',
    );
    expect(capture.output()).toContain("Overlap Resolution");
    expect(capture.output()).toContain("Overlap resolution complete");
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(String(selectMock.mock.calls[0]?.[0]?.message)).toContain(
      "Which section should own src/index.ts?",
    );
  });

  test("doctor --all returns the overlap exit code when conflicts exist", async () => {
    const project = await createOverlapProject();
    const { main } = await import("../../src/cli/main.js");

    await expect(
      main(["doctor", "--all", "--config", project.configPath]),
    ).resolves.toBe(4);
  });
});
