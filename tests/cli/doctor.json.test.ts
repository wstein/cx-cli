import { describe, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { main } from "../../src/cli/main.js";
import { loadCxConfig } from "../../src/config/load.js";
import { buildBundlePlan } from "../../src/planning/buildPlan.js";

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
      "ghp_123456789012345678901234567890123456\n",
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
---

Tracked: [[src/index.ts]]
Generated: [[generated/client.ts]]
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

function captureStdout(): { restore: () => void; output: () => string } {
  const write = process.stdout.write;
  let output = "";
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output += String(chunk);
    return true;
  }) as typeof process.stdout.write;
  return {
    restore: () => {
      process.stdout.write = write;
    },
    output: () => output,
  };
}

describe("doctor JSON lane", () => {
  test("doctor overlaps reports conflicts as JSON", async () => {
    const project = await createOverlapProject();
    const capture = captureStdout();
    try {
      await expect(
        main(["doctor", "overlaps", "--json", "--config", project.configPath]),
      ).resolves.toBe(4);
    } finally {
      capture.restore();
    }

    const payload = JSON.parse(capture.output()) as {
      conflictCount?: number;
      conflicts?: Array<{
        path: string;
        sections: string[];
        recommendedOwner: string;
      }>;
    };

    expect(payload.conflictCount).toBe(1);
    expect(payload.conflicts?.[0]?.path).toBe("src/index.ts");
    expect(payload.conflicts?.[0]?.sections).toEqual(["src", "mixed"]);
    expect(payload.conflicts?.[0]?.recommendedOwner).toBe("src");
  });

  test("doctor fix-overlaps --dry-run leaves cx.toml unchanged", async () => {
    const project = await createOverlapProject();
    const before = await fs.readFile(project.configPath, "utf8");
    const capture = captureStdout();

    try {
      await expect(
        main([
          "doctor",
          "fix-overlaps",
          "--dry-run",
          "--json",
          "--config",
          project.configPath,
        ]),
      ).resolves.toBe(4);
    } finally {
      capture.restore();
    }

    const after = await fs.readFile(project.configPath, "utf8");
    expect(after).toBe(before);

    const payload = JSON.parse(capture.output()) as {
      changed?: boolean;
      excludesBySection?: Record<string, string[]>;
    };
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
    const cwd = process.cwd();
    process.chdir(project.root);
    const capture = captureStdout();
    try {
      await expect(
        main(["doctor", "mcp", "--json", "--config", project.configPath]),
      ).resolves.toBe(0);
    } finally {
      capture.restore();
      process.chdir(cwd);
    }

    const payload = JSON.parse(capture.output()) as {
      resolvedConfigPath?: string;
      activeProfile?: string;
      filesInclude?: string[];
      filesExclude?: string[];
      sectionNames?: string[];
    };
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
    const cwd = process.cwd();
    process.chdir(project.root);
    const capture = captureStdout();
    try {
      await expect(
        main(["doctor", "notes", "--json", "--config", project.configPath]),
      ).resolves.toBe(4);
    } finally {
      capture.restore();
      process.chdir(cwd);
    }

    const payload = JSON.parse(capture.output()) as {
      driftCount?: number;
      outsideMasterListCount?: number;
      drifts?: Array<{ path: string; status: string }>;
    };
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
    const cwd = process.cwd();
    process.chdir(project.root);
    const capture = captureStdout();
    try {
      await expect(
        main(["doctor", "notes", "--json", "--config", project.configPath]),
      ).resolves.toBe(0);
    } finally {
      capture.restore();
      process.chdir(cwd);
    }

    const payload = JSON.parse(capture.output()) as {
      driftCount?: number;
    };
    expect(payload.driftCount).toBe(0);
  });

  test("doctor secrets reports suspicious files as JSON", async () => {
    const project = await createMcpProject({ includeSecret: true });
    const cwd = process.cwd();
    process.chdir(project.root);
    const capture = captureStdout();
    try {
      await expect(
        main(["doctor", "secrets", "--json", "--config", project.configPath]),
      ).resolves.toBe(4);
    } finally {
      capture.restore();
      process.chdir(cwd);
    }

    const payload = JSON.parse(capture.output()) as {
      suspiciousCount?: number;
      suspiciousFiles?: Array<{ filePath: string; messages: string[] }>;
    };
    expect(payload.suspiciousCount).toBe(1);
    expect(payload.suspiciousFiles?.[0]?.filePath).toBe("secrets.txt");
    expect(payload.suspiciousFiles?.[0]?.messages?.[0]).toContain(
      "GitHub Token",
    );
  });

  test("doctor workflow emits JSON recommendations", async () => {
    const capture = captureStdout();
    try {
      await expect(
        main([
          "doctor",
          "workflow",
          "--json",
          "--task",
          "update notes during investigation",
        ]),
      ).resolves.toBe(0);
    } finally {
      capture.restore();
    }

    const payload = JSON.parse(capture.output()) as {
      mode?: string;
      sequence?: string[];
      reason?: string;
      signals?: string[];
    };
    expect(payload.mode).toBe("mcp");
    expect(payload.reason).toContain("live MCP workspace");
    expect(payload.signals).toContain("mcp");
    expect(payload.sequence).toEqual(["mcp"]);
  });
});
