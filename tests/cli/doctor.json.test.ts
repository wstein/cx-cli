// test-lane: integration
import { describe, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { main } from "../../src/cli/main.js";
import { loadCxConfig } from "../../src/config/load.js";
import { buildBundlePlan } from "../../src/planning/buildPlan.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";
import { parseJsonOutput } from "../helpers/cli/parseJsonOutput.js";

const execFileAsync = promisify(execFile);
const GITHUB_TOKEN_FIXTURE = "ghp_" + "123456789012345678901234567890123456";

async function initGitRepo(root: string): Promise<void> {
  await execFileAsync("git", ["init", "-q"], { cwd: root });
  await execFileAsync("git", ["config", "user.email", "cx@example.com"], {
    cwd: root,
  });
  await execFileAsync("git", ["config", "user.name", "cx"], { cwd: root });
  await execFileAsync("git", ["add", "."], { cwd: root });
  await execFileAsync("git", ["commit", "-q", "-m", "init"], { cwd: root });
}

async function createOverlapProject(): Promise<{
  root: string;
  configPath: string;
}> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-doctor-"));
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

async function createMcpProject(
  options: { includeSecret?: boolean } = {},
): Promise<{ root: string; configPath: string; mcpPath: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-doctor-mcp-"));
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.writeFile(
    path.join(root, "src", "index.ts"),
    "export const value = 1;\n",
    "utf8",
  );

  if (options.includeSecret === true) {
    await fs.writeFile(
      path.join(root, "secrets.txt"),
      `${GITHUB_TOKEN_FIXTURE}\n`,
      "utf8",
    );
  }

  const configPath = path.join(root, "cx.toml");
  const mcpPath = path.join(root, "cx-mcp.toml");
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
include = ["src/generated/**"]
exclude = ["node_modules/**"]
follow_symlinks = false
unmatched = "ignore"

[sections.src]
include = ["src/**"]
exclude = ["src/generated/**"]
`,
    "utf8",
  );

  await fs.writeFile(
    mcpPath,
    `extends = "cx.toml"

[files]
include = ["dist/**"]
exclude = ["tests/**"]
`,
    "utf8",
  );
  await initGitRepo(root);
  return { root, configPath, mcpPath };
}

async function createNotesProject(
  options: { includeGenerated?: boolean; addGeneratedFile?: boolean } = {},
): Promise<{ root: string; configPath: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-doctor-notes-"));
  await fs.mkdir(path.join(root, "notes"), { recursive: true });
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.mkdir(path.join(root, "generated"), { recursive: true });
  await fs.writeFile(
    path.join(root, "src", "index.ts"),
    "export const value = 1;\n",
    "utf8",
  );
  await fs.writeFile(
    path.join(root, "notes", "architecture.md"),
    `---
id: 20260418141500
title: Architecture
aliases: []
tags: []
---

This architecture note tracks repository-backed files and generated drift candidates.

Tracked: [[src/index.ts]]
Generated: [[generated/client.ts]]

## Links

`,
    "utf8",
  );

  const configPath = path.join(root, "cx.toml");
  await fs.writeFile(
    configPath,
    `schema_version = 1
project_name = "demo"
source_root = "."
output_dir = "dist/demo-bundle"

[files]
include = ${options.includeGenerated === true ? '["generated/**"]' : "[]"}
exclude = ["dist/**"]
follow_symlinks = false
unmatched = "ignore"

[sections.src]
include = ["src/**"]
exclude = []
`,
    "utf8",
  );

  await initGitRepo(root);

  if (options.addGeneratedFile === true) {
    await fs.writeFile(
      path.join(root, "generated", "client.ts"),
      "export const generated = true;\n",
      "utf8",
    );
  }

  return { root, configPath };
}

async function runDoctorCli(params: { argv: string[]; cwd?: string }): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
  logs: string;
}> {
  const capture = createBufferedCommandIo(
    params.cwd === undefined ? {} : { cwd: params.cwd },
  );
  const exitCode = await main(params.argv, capture.io);
  return {
    exitCode,
    stdout: capture.stdout(),
    stderr: capture.stderr(),
    logs: capture.logs(),
  };
}

describe("doctor JSON lane", () => {
  test("doctor overlaps reports conflicts as JSON", async () => {
    const project = await createOverlapProject();
    const result = await runDoctorCli({
      argv: ["doctor", "overlaps", "--json", "--config", project.configPath],
    });
    expect(result.exitCode).toBe(4);

    const payload = parseJsonOutput<{
      conflictCount?: number;
      conflicts?: Array<{
        path: string;
        sections: string[];
        recommendedOwner: string;
      }>;
    }>(result.stdout);

    expect(payload.conflictCount).toBe(1);
    expect(payload.conflicts?.[0]?.path).toBe("src/index.ts");
    expect(payload.conflicts?.[0]?.sections).toEqual(["src", "mixed"]);
    expect(payload.conflicts?.[0]?.recommendedOwner).toBe("src");
  });

  test("doctor fix-overlaps --dry-run leaves cx.toml unchanged", async () => {
    const project = await createOverlapProject();
    const before = await fs.readFile(project.configPath, "utf8");
    const result = await runDoctorCli({
      argv: [
        "doctor",
        "fix-overlaps",
        "--dry-run",
        "--json",
        "--config",
        project.configPath,
      ],
    });
    expect(result.exitCode).toBe(4);

    const after = await fs.readFile(project.configPath, "utf8");
    expect(after).toBe(before);

    const payload = parseJsonOutput<{
      changed?: boolean;
      excludesBySection?: Record<string, string[]>;
    }>(result.stdout);
    expect(payload.changed).toBe(false);
    expect(payload.excludesBySection).toEqual({ mixed: ["src/index.ts"] });
  });

  test("doctor fix-overlaps updates cx.toml and unblocks planning", async () => {
    const project = await createOverlapProject();
    await expect(
      main(["doctor", "fix-overlaps", "--config", project.configPath]),
    ).resolves.toBe(0);

    const configSource = await fs.readFile(project.configPath, "utf8");
    expect(configSource).toContain(
      '[sections.mixed]\ninclude = ["src/**"]\nexclude = ["src/index.ts"]',
    );

    const config = await loadCxConfig(project.configPath);
    await expect(buildBundlePlan(config)).resolves.toBeDefined();
  });

  test("doctor mcp reports inherited profile as JSON", async () => {
    const project = await createMcpProject();
    const result = await runDoctorCli({
      argv: ["doctor", "mcp", "--json", "--config", project.configPath],
      cwd: project.root,
    });
    expect(result.exitCode).toBe(0);

    const payload = parseJsonOutput<{
      resolvedConfigPath?: string;
      activeProfile?: string;
      filesInclude?: string[];
      filesExclude?: string[];
      sectionNames?: string[];
    }>(result.stdout);
    expect(payload.resolvedConfigPath).toBe(project.mcpPath);
    expect(payload.activeProfile).toBe("cx-mcp.toml");
    expect(payload.filesInclude).toEqual(["src/generated/**", "dist/**"]);
    expect(payload.filesExclude).toEqual(["node_modules/**", "tests/**"]);
    expect(payload.sectionNames).toEqual(["src"]);
  });

  test("doctor notes reports note-to-code drift against the master list", async () => {
    const project = await createNotesProject({
      includeGenerated: false,
      addGeneratedFile: true,
    });
    const result = await runDoctorCli({
      argv: ["doctor", "notes", "--json", "--config", project.configPath],
      cwd: project.root,
    });
    expect(result.exitCode).toBe(4);

    const payload = parseJsonOutput<{
      driftCount?: number;
      outsideMasterListCount?: number;
      drifts?: Array<{ path: string; status: string }>;
    }>(result.stdout);
    expect(payload.driftCount).toBe(1);
    expect(payload.outsideMasterListCount).toBe(1);
    expect(payload.drifts?.[0]?.path).toBe("generated/client.ts");
    expect(payload.drifts?.[0]?.status).toBe("outside_master_list");
  });

  test("doctor notes accepts files explicitly included into the master list", async () => {
    const project = await createNotesProject({
      includeGenerated: true,
      addGeneratedFile: true,
    });
    const result = await runDoctorCli({
      argv: ["doctor", "notes", "--json", "--config", project.configPath],
      cwd: project.root,
    });
    expect(result.exitCode).toBe(0);

    const payload = parseJsonOutput<{
      driftCount?: number;
    }>(result.stdout);
    expect(payload.driftCount).toBe(0);
  });

  test("doctor secrets reports suspicious files as JSON", async () => {
    const project = await createMcpProject({ includeSecret: true });
    const result = await runDoctorCli({
      argv: ["doctor", "secrets", "--json", "--config", project.configPath],
      cwd: project.root,
    });
    expect(result.exitCode).toBe(4);

    const payload = parseJsonOutput<{
      suspiciousCount?: number;
      suspiciousFiles?: Array<{ filePath: string; messages: string[] }>;
    }>(result.stdout);
    expect(payload.suspiciousCount).toBe(1);
    expect(payload.suspiciousFiles?.[0]?.filePath).toBe("secrets.txt");
    expect(payload.suspiciousFiles?.[0]?.messages?.[0]).toContain(
      "GitHub Token",
    );
  });

  test("doctor workflow emits JSON recommendations", async () => {
    const result = await runDoctorCli({
      argv: [
        "doctor",
        "workflow",
        "--json",
        "--task",
        "update notes during investigation",
      ],
    });
    expect(result.exitCode).toBe(0);

    const payload = parseJsonOutput<{
      mode?: string;
      sequence?: string[];
      reason?: string;
      signals?: string[];
    }>(result.stdout);
    expect(payload.mode).toBe("mcp");
    expect(payload.reason).toContain("live MCP workspace");
    expect(payload.signals).toContain("mcp");
    expect(payload.sequence).toEqual(["mcp"]);
  });
});
