import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runConfigCommand } from "../../src/cli/commands/config.js";
import { captureCli } from "../helpers/cli/captureCli.js";

let testDir: string;
const originalEnv = { ...process.env };

beforeEach(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-config-test-"));
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
  process.env.CX_STRICT = originalEnv.CX_STRICT;
  process.env.CX_DEDUP_MODE = originalEnv.CX_DEDUP_MODE;
  process.env.CX_REPOMIX_MISSING_EXTENSION =
    originalEnv.CX_REPOMIX_MISSING_EXTENSION;
  process.env.CX_CONFIG_DUPLICATE_ENTRY = originalEnv.CX_CONFIG_DUPLICATE_ENTRY;
});

describe("Config Command", () => {
  test("no config file + JSON output", async () => {
    const configPath = path.join(testDir, "cx.toml");
    const result = await captureCli({
      run: () =>
        runConfigCommand({
          config: configPath,
          json: true,
        }),
      parseJson: true,
    });

    expect(result.exitCode).toBe(0);
    expect(result.parsedJson).toBeDefined();
    const json = result.parsedJson as Record<string, unknown>;
    expect(json.configFile).toBeNull();
    expect(json.settings).toBeDefined();
  });

  test("no config file + text output", async () => {
    const configPath = path.join(testDir, "cx.toml");
    const result = await captureCli({
      run: () =>
        runConfigCommand({
          config: configPath,
          json: false,
        }),
      captureConsoleLog: true,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Effective behavioral settings");
    expect(result.stdout).toContain("(not found)");
    expect(result.stdout).toContain("dedup.mode");
    expect(result.stdout).toContain("Setting");
    expect(result.stdout).toContain("Value");
    expect(result.stdout).toContain("Source");
  });

  test("config file with explicit dedup.mode + JSON", async () => {
    const configPath = path.join(testDir, "cx.toml");
    await fs.writeFile(
      configPath,
      `schema_version = 1
project_name = "test"
source_root = "."
output_dir = "dist"

[repomix]
style = "xml"

[dedup]
mode = "fail"

[files]
exclude = []
`,
    );

    const result = await captureCli({
      run: () =>
        runConfigCommand({
          config: configPath,
          json: true,
        }),
      parseJson: true,
    });

    expect(result.exitCode).toBe(0);
    const json = result.parsedJson as Record<string, unknown>;
    expect(json.configFile).toBe(configPath);
    const settings = json.settings as Record<string, Record<string, unknown>>;
    expect(settings["dedup.mode"]?.source).toBe("cx.toml");
    expect(settings["dedup.mode"]?.value).toBe("fail");
  });

  test("CX_STRICT=true env var", async () => {
    const configPath = path.join(testDir, "cx.toml");
    process.env.CX_STRICT = "true";

    const result = await captureCli({
      run: () =>
        runConfigCommand({
          config: configPath,
          json: true,
        }),
      parseJson: true,
    });

    expect(result.exitCode).toBe(0);
    const json = result.parsedJson as Record<string, unknown>;
    expect(json.cxStrict).toBe(true);
  });

  test("env var overrides cx.toml — shadow warning", async () => {
    const configPath = path.join(testDir, "cx.toml");
    await fs.writeFile(
      configPath,
      `schema_version = 1
project_name = "test"
source_root = "."
output_dir = "dist"

[repomix]
style = "xml"

[dedup]
mode = "warn"

[files]
exclude = []
`,
    );

    process.env.CX_DEDUP_MODE = "fail";

    const result = await captureCli({
      run: () =>
        runConfigCommand({
          config: configPath,
          json: false,
        }),
      captureConsoleLog: true,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain("Warning");
    expect(result.stderr).toContain("dedup.mode");
    expect(result.stderr).toContain("overridden");
  });

  test("malformed cx.toml + JSON error", async () => {
    const configPath = path.join(testDir, "cx.toml");
    await fs.writeFile(configPath, "invalid toml content [[[");

    const result = await captureCli({
      run: () =>
        runConfigCommand({
          config: configPath,
          json: true,
        }),
      parseJson: true,
    });

    expect(result.exitCode).toBe(1);
    const json = result.parsedJson as Record<string, unknown>;
    expect(json.error).toBeDefined();
  });

  test("malformed cx.toml + text error", async () => {
    const configPath = path.join(testDir, "cx.toml");
    await fs.writeFile(configPath, "invalid toml [[[");

    const result = await captureCli({
      run: () =>
        runConfigCommand({
          config: configPath,
          json: false,
        }),
      captureConsoleLog: true,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Error");
  });
});
