import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { loadCxConfig } from "../../src/config/load.js";

describe("loadCxConfig", () => {
  test("loads a valid config and applies defaults", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-config-"));
    const configPath = path.join(tempDir, "cx.toml");
    await fs.writeFile(
      configPath,
      `schema_version = 1
project_name = "demo"
source_root = "."
output_dir = "dist/demo-bundle"

[repomix]
style = "xml"

[sections.src]
include = ["src/**"]
exclude = []
`,
      "utf8",
    );

    const config = await loadCxConfig(configPath);
    expect(config.projectName).toBe("demo");
    expect(config.assets.targetDir).toBe("demo-assets");
    expect(config.checksums.fileName).toBe("demo.sha256");
    expect(config.tokens.algorithm).toBe("chars_div_4");
    expect(config.display.list.bytesWarm).toBe(4096);
    expect(config.sections.src?.include).toEqual(["src/**"]);
  });

  test("loads token and list display overrides", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-config-list-"));
    const configPath = path.join(tempDir, "cx.toml");
    await fs.writeFile(
      configPath,
      `schema_version = 1
project_name = "demo"
source_root = "."
output_dir = "dist/demo-bundle"

[repomix]
style = "xml"

[tokens]
algorithm = "chars_div_3"

[display.list]
bytes_warm = 2048
bytes_hot = 32768
tokens_warm = 256
tokens_hot = 1024
mtime_warm_minutes = 30
mtime_hot_hours = 12
time_palette = [255, 254, 253, 252, 251, 250, 249, 248]

[sections.src]
include = ["src/**"]
exclude = []
`,
      "utf8",
    );

    const config = await loadCxConfig(configPath);
    expect(config.tokens.algorithm).toBe("chars_div_3");
    expect(config.display.list.bytesWarm).toBe(2048);
    expect(config.display.list.bytesHot).toBe(32768);
    expect(config.display.list.tokensWarm).toBe(256);
    expect(config.display.list.tokensHot).toBe(1024);
    expect(config.display.list.mtimeWarmMinutes).toBe(30);
    expect(config.display.list.mtimeHotHours).toBe(12);
    expect(config.display.list.timePalette).toEqual([
      255, 254, 253, 252, 251, 250, 249, 248,
    ]);
  });

  test("rejects invalid time palette shape", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-config-palette-"));
    const configPath = path.join(tempDir, "cx.toml");
    await fs.writeFile(
      configPath,
      `schema_version = 1
project_name = "demo"
source_root = "."
output_dir = "dist/demo-bundle"

[repomix]
style = "xml"

[display.list]
time_palette = [255, 255, 254]

[sections.src]
include = ["src/**"]
exclude = []
`,
      "utf8",
    );

    await expect(loadCxConfig(configPath)).rejects.toThrow(
      "display.list.time_palette must contain between 8 and 10 grayscale entries.",
    );
  });

  test("rejects invalid list display threshold ordering", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-config-order-"));
    const configPath = path.join(tempDir, "cx.toml");
    await fs.writeFile(
      configPath,
      `schema_version = 1
project_name = "demo"
source_root = "."
output_dir = "dist/demo-bundle"

[repomix]
style = "xml"

[display.list]
bytes_warm = 4096
bytes_hot = 4096

[sections.src]
include = ["src/**"]
exclude = []
`,
      "utf8",
    );

    await expect(loadCxConfig(configPath)).rejects.toThrow(
      "display.list.bytes_hot must be greater than display.list.bytes_warm.",
    );
  });

  test("expands tilde and environment variables in config paths", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-config-env-"));
    const configPath = path.join(tempDir, "cx.toml");
    const previousOutputBase = process.env.CX_OUTPUT_BASE;
    process.env.CX_OUTPUT_BASE = path.join(tempDir, "artifacts");

    await fs.writeFile(
      configPath,
      `schema_version = 1
project_name = "demo"
source_root = "\${HOME}/workspace"
output_dir = "$CX_OUTPUT_BASE/{project}"

[repomix]
style = "xml"

[sections.src]
include = ["src/**"]
exclude = []
`,
      "utf8",
    );

    const config = await loadCxConfig(configPath);
    process.env.CX_OUTPUT_BASE = previousOutputBase;
    expect(config.sourceRoot).toBe(path.join(os.homedir(), "workspace"));
    expect(config.outputDir).toBe(path.join(tempDir, "artifacts", "demo"));
  });

  test("expands a leading tilde in output_dir", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-config-home-"));
    const configPath = path.join(tempDir, "cx.toml");
    await fs.writeFile(
      configPath,
      `schema_version = 1
project_name = "demo"
source_root = "."
output_dir = "~/Downloads/demo-bundle"

[repomix]
style = "xml"

[sections.src]
include = ["src/**"]
exclude = []
`,
      "utf8",
    );

    const config = await loadCxConfig(configPath);
    expect(config.outputDir).toBe(
      path.join(os.homedir(), "Downloads/demo-bundle"),
    );
  });

  test("fails when a config path references an undefined environment variable", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-config-missing-env-"),
    );
    const configPath = path.join(tempDir, "cx.toml");
    delete process.env.CX_MISSING_OUTPUT_DIR;

    await fs.writeFile(
      configPath,
      `schema_version = 1
project_name = "demo"
source_root = "."
output_dir = "$CX_MISSING_OUTPUT_DIR/demo-bundle"

[repomix]
style = "xml"

[sections.src]
include = ["src/**"]
exclude = []
`,
      "utf8",
    );

    await expect(loadCxConfig(configPath)).rejects.toThrow(
      "output_dir references undefined environment variable CX_MISSING_OUTPUT_DIR.",
    );
  });
});
