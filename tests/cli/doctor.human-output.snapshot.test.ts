import { describe, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { main } from "../../src/cli/main.js";
import { captureCli } from "../helpers/cli/captureCli.js";
import { assertTextSnapshot } from "../helpers/snapshot/assertSnapshot.js";
import { scrubTextSnapshot } from "../helpers/snapshot/scrubbers.js";

const execFileAsync = promisify(execFile);

async function initGitRepo(root: string): Promise<void> {
  await execFileAsync("git", ["init", "-q"], { cwd: root });
  await execFileAsync("git", ["config", "user.email", "cx@example.com"], {
    cwd: root,
  });
  await execFileAsync("git", ["config", "user.name", "cx"], { cwd: root });
  await execFileAsync("git", ["add", "."], { cwd: root });
  await execFileAsync("git", ["commit", "-q", "-m", "init"], { cwd: root });
}

async function createMcpProject(): Promise<{
  root: string;
  configPath: string;
}> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-doctor-human-"));
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
security_check = true

[files]
exclude = ["node_modules/**"]
follow_symlinks = false
unmatched = "ignore"

[sections.src]
include = ["src/**"]
exclude = []
`,
    "utf8",
  );
  await initGitRepo(root);
  return { root, configPath };
}

describe("doctor human snapshot lane", () => {
  test("doctor --all human output snapshot", async () => {
    const project = await createMcpProject();
    const cwd = process.cwd();
    process.chdir(project.root);
    let result: Awaited<ReturnType<typeof captureCli>>;
    try {
      result = await captureCli({
        run: () => main(["doctor", "--all", "--config", project.configPath]),
      });
    } finally {
      process.chdir(cwd);
    }
    expect(result.exitCode).toBe(0);

    const scrubbed = scrubTextSnapshot(result.stdout, {
      rootDir: project.root,
      stripVersions: true,
    });

    await assertTextSnapshot({
      snapshotPath: path.join(
        process.cwd(),
        "tests/fixtures/snapshots/cli/doctor-all-human.txt",
      ),
      actual: scrubbed,
    });
  });

  test("doctor workflow mixed human output snapshot", async () => {
    const result = await captureCli({
      run: () =>
        main([
          "doctor",
          "workflow",
          "--task",
          "inspect the plan, bundle a handoff snapshot, and update notes in MCP",
        ]),
    });
    expect(result.exitCode).toBe(0);

    const scrubbed = scrubTextSnapshot(result.stdout);
    await assertTextSnapshot({
      snapshotPath: path.join(
        process.cwd(),
        "tests/fixtures/snapshots/cli/doctor-workflow-human.txt",
      ),
      actual: scrubbed,
    });
  });
});
