import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runDoctorCommand } from "../../src/cli/commands/doctor.js";
import { CxError } from "../../src/shared/errors.js";
import { captureCli } from "../helpers/cli/captureCli.js";

const MIN_CONFIG = `schema_version = 1
project_name = "proj"
source_root = "."
output_dir = "dist/proj"

[sections.main]
include = ["src/**"]
exclude = []
`;

let testDir: string;
let configPath: string;

beforeEach(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-doctor-test-"));
  configPath = path.join(testDir, "cx.toml");
  await fs.writeFile(configPath, MIN_CONFIG, "utf8");
});

describe("runDoctorCommand — argument validation", () => {
  test("throws CxError when --all and --json are both set", async () => {
    await expect(runDoctorCommand({ all: true, json: true })).rejects.toThrow(
      CxError,
    );
  });

  test("throws CxError when no subcommand and --all is not set", async () => {
    await expect(runDoctorCommand({})).rejects.toThrow(CxError);
  });

  test("throws CxError on unknown subcommand", async () => {
    await expect(
      // biome-ignore lint/suspicious/noExplicitAny: intentional invalid value for test
      runDoctorCommand({ subcommand: "bogus" as any }),
    ).rejects.toThrow(CxError);
  });

  test("throws CxError for fix-overlaps --interactive when stdin is not a TTY", async () => {
    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", {
      value: false,
      writable: true,
      configurable: true,
    });

    try {
      await expect(
        runDoctorCommand({
          subcommand: "fix-overlaps",
          interactive: true,
          config: "/nonexistent/cx.toml",
        }),
      ).rejects.toThrow(CxError);
    } finally {
      Object.defineProperty(process.stdin, "isTTY", {
        value: originalIsTTY,
        writable: true,
        configurable: true,
      });
    }
  });
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
});

describe("runDoctorCommand — workflow subcommand", () => {
  test("throws CxError when --task is not provided", async () => {
    await expect(runDoctorCommand({ subcommand: "workflow" })).rejects.toThrow(
      CxError,
    );
  });

  test("throws CxError when --task is only whitespace", async () => {
    await expect(
      runDoctorCommand({ subcommand: "workflow", task: "   " }),
    ).rejects.toThrow(CxError);
  });

  test("text output: prints task, recommended path, mode, reason, signals", async () => {
    const { stdout, exitCode } = await captureCli({
      run: () =>
        runDoctorCommand({ subcommand: "workflow", task: "inspect tokens" }),
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Task: inspect tokens");
    expect(stdout).toContain("Recommended path:");
    expect(stdout).toContain("Primary mode:");
    expect(stdout).toContain("Reason:");
    expect(stdout).toContain("Signals:");
  });

  test("json=true outputs structured JSON with task and mode", async () => {
    const { stdout, exitCode } = await captureCli({
      run: () =>
        runDoctorCommand({
          subcommand: "workflow",
          task: "bundle the snapshot",
          json: true,
        }),
      parseJson: true,
    });
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    expect(parsed.task).toBe("bundle the snapshot");
    expect(typeof parsed.mode).toBe("string");
    expect(Array.isArray(parsed.sequence)).toBe(true);
  });
});

describe("runDoctorCommand — overlaps subcommand", () => {
  test("exits 0 when no overlaps in config", async () => {
    const { exitCode } = await captureCli({
      run: () =>
        runDoctorCommand({ subcommand: "overlaps", config: configPath }),
    });
    expect(exitCode).toBe(0);
  });

  test("json=true outputs structured JSON", async () => {
    const { stdout, exitCode } = await captureCli({
      run: () =>
        runDoctorCommand({
          subcommand: "overlaps",
          config: configPath,
          json: true,
        }),
      parseJson: true,
    });
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    expect(typeof parsed.conflictCount).toBe("number");
  });
});

describe("runDoctorCommand — fix-overlaps subcommand", () => {
  test("no-conflicts path exits 0 and reports clean", async () => {
    const { stdout, exitCode } = await captureCli({
      run: () =>
        runDoctorCommand({ subcommand: "fix-overlaps", config: configPath }),
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("No section overlaps");
  });

  test("no-conflicts + json=true outputs changed:false", async () => {
    const { stdout, exitCode } = await captureCli({
      run: () =>
        runDoctorCommand({
          subcommand: "fix-overlaps",
          config: configPath,
          json: true,
        }),
      parseJson: true,
    });
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    expect(parsed.changed).toBe(false);
    expect(parsed.conflictCount).toBe(0);
  });
});

describe("runDoctorCommand — mcp subcommand", () => {
  test("exits 0 with valid config", async () => {
    const { exitCode } = await captureCli({
      run: () => runDoctorCommand({ subcommand: "mcp", config: configPath }),
    });
    expect(exitCode).toBe(0);
  });

  test("json=true outputs structured JSON with activeProfile", async () => {
    const { stdout, exitCode } = await captureCli({
      run: () =>
        runDoctorCommand({ subcommand: "mcp", config: configPath, json: true }),
      parseJson: true,
    });
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    expect(typeof parsed.activeProfile).toBe("string");
  });
});

describe("runDoctorCommand — notes subcommand", () => {
  test("exits 0 when note references stay inside the master list", async () => {
    await fs.mkdir(path.join(testDir, "notes"), { recursive: true });
    await fs.mkdir(path.join(testDir, "src"), { recursive: true });
    await fs.writeFile(
      path.join(testDir, "src", "index.ts"),
      "export const value = 1;\n",
      "utf8",
    );
    await fs.writeFile(
      path.join(testDir, "notes", "architecture.md"),
      `---
id: 20260418133000
title: Architecture
---

See [[src/index.ts]] before refactoring.
`,
      "utf8",
    );

    const { exitCode } = await captureCli({
      run: () => runDoctorCommand({ subcommand: "notes", config: configPath }),
    });
    expect(exitCode).toBe(0);
  });

  test("json=true outputs structured drift counts", async () => {
    await fs.mkdir(path.join(testDir, "notes"), { recursive: true });
    await fs.mkdir(path.join(testDir, "src"), { recursive: true });
    await fs.writeFile(
      path.join(testDir, "src", "index.ts"),
      "export const value = 1;\n",
      "utf8",
    );
    await fs.writeFile(
      path.join(testDir, "notes", "architecture.md"),
      `---
id: 20260418133001
title: Architecture
---

See [[src/missing.ts]] before refactoring.
`,
      "utf8",
    );

    const { stdout, exitCode } = await captureCli({
      run: () =>
        runDoctorCommand({
          subcommand: "notes",
          config: configPath,
          json: true,
        }),
      parseJson: true,
    });
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    expect(parsed.driftCount).toBe(1);
    expect(parsed.missingCount).toBe(1);
  });
});

describe("runDoctorCommand — secrets subcommand", () => {
  test("exits 0 when no suspicious files", async () => {
    const { exitCode } = await captureCli({
      run: () =>
        runDoctorCommand({ subcommand: "secrets", config: configPath }),
    });
    expect(exitCode).toBe(0);
  });
});

describe("runDoctorCommand — --all flag", () => {
  test("runs all diagnostics and exits 0 with clean config", async () => {
    const { exitCode } = await captureCli({
      run: () => runDoctorCommand({ all: true, config: configPath }),
    });
    expect(exitCode).toBe(0);
  });
});
