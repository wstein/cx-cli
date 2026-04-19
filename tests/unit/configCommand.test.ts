// test-lane: unit
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runConfigCommand } from "../../src/cli/commands/config.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";

let testDir: string;
const originalEnv = { ...process.env };

function restoreEnvVar(
  name: keyof typeof originalEnv | string,
  value: string | undefined,
): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

beforeEach(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-config-test-"));
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
  restoreEnvVar("CX_STRICT", originalEnv.CX_STRICT);
  restoreEnvVar("CX_DEDUP_MODE", originalEnv.CX_DEDUP_MODE);
  restoreEnvVar(
    "CX_REPOMIX_MISSING_EXTENSION",
    originalEnv.CX_REPOMIX_MISSING_EXTENSION,
  );
  restoreEnvVar(
    "CX_CONFIG_DUPLICATE_ENTRY",
    originalEnv.CX_CONFIG_DUPLICATE_ENTRY,
  );
});

describe("Config Command", () => {
  test("no config file + JSON output", async () => {
    const configPath = path.join(testDir, "cx.toml");
    const capture = createBufferedCommandIo();
    const exitCode = await runConfigCommand(
      {
        config: configPath,
        json: true,
      },
      capture.io,
    );

    expect(exitCode).toBe(0);
    const json = JSON.parse(capture.stdout()) as Record<string, unknown>;
    expect(json.configFile).toBeNull();
    expect(json.settings).toBeDefined();
  });

  test("no config file + text output", async () => {
    const configPath = path.join(testDir, "cx.toml");
    const capture = createBufferedCommandIo();
    const exitCode = await runConfigCommand(
      {
        config: configPath,
        json: false,
      },
      capture.io,
    );

    expect(exitCode).toBe(0);
    expect(capture.stdout()).toContain("Effective behavioral settings");
    expect(capture.stdout()).toContain("(not found)");
    expect(capture.stdout()).toContain("dedup.mode");
    expect(capture.stdout()).toContain("Setting");
    expect(capture.stdout()).toContain("Value");
    expect(capture.stdout()).toContain("Source");
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

    const capture = createBufferedCommandIo();
    const exitCode = await runConfigCommand(
      {
        config: configPath,
        json: true,
      },
      capture.io,
    );

    expect(exitCode).toBe(0);
    const json = JSON.parse(capture.stdout()) as Record<string, unknown>;
    expect(json.configFile).toBe(configPath);
    const settings = json.settings as Record<string, Record<string, unknown>>;
    expect(settings["dedup.mode"]?.source).toBe("cx.toml");
    expect(settings["dedup.mode"]?.value).toBe("fail");
  });

  test("CX_STRICT=true env var", async () => {
    const configPath = path.join(testDir, "cx.toml");
    process.env.CX_STRICT = "true";

    const capture = createBufferedCommandIo();
    const env = { ...process.env, CX_STRICT: "true" };
    const exitCode = await runConfigCommand(
      {
        config: configPath,
        json: true,
      },
      { ...capture.io, env },
    );

    expect(exitCode).toBe(0);
    const json = JSON.parse(capture.stdout()) as Record<string, unknown>;
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

    const capture = createBufferedCommandIo();
    const env = { ...process.env, CX_DEDUP_MODE: "fail" };
    const exitCode = await runConfigCommand(
      {
        config: configPath,
        json: false,
      },
      { ...capture.io, env },
    );

    expect(exitCode).toBe(0);
    expect(capture.stderr()).toContain("Warning");
    expect(capture.stderr()).toContain("dedup.mode");
    expect(capture.stderr()).toContain("overridden");
  });

  test("malformed cx.toml + JSON error", async () => {
    const configPath = path.join(testDir, "cx.toml");
    await fs.writeFile(configPath, "invalid toml content [[[");

    const capture = createBufferedCommandIo();
    const exitCode = await runConfigCommand(
      {
        config: configPath,
        json: true,
      },
      capture.io,
    );

    expect(exitCode).toBe(1);
    const json = JSON.parse(capture.stdout()) as Record<string, unknown>;
    expect(json.error).toBeDefined();
  });

  test("malformed cx.toml + text error", async () => {
    const configPath = path.join(testDir, "cx.toml");
    await fs.writeFile(configPath, "invalid toml [[[");

    const capture = createBufferedCommandIo();
    const exitCode = await runConfigCommand(
      {
        config: configPath,
        json: false,
      },
      capture.io,
    );

    expect(exitCode).toBe(1);
    expect(capture.stderr()).toContain("Error");
  });
});
