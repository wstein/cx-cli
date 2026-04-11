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
    expect(config.tokens.encoding).toBe("o200k_base");
    expect(config.sections.src?.include).toEqual(["src/**"]);
  });

  test("loads token encoding overrides", async () => {
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
encoding = "cl100k_base"

[sections.src]
include = ["src/**"]
exclude = []
`,
      "utf8",
    );

    const config = await loadCxConfig(configPath);
    expect(config.tokens.encoding).toBe("cl100k_base");
  });

  test("rejects project-level display settings", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-config-palette-"),
    );
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
time_palette = [255, 254, 253, 252, 251, 250, 249, 248]

[sections.src]
include = ["src/**"]
exclude = []
`,
      "utf8",
    );

    await expect(loadCxConfig(configPath)).rejects.toThrow(
      "display settings are no longer supported in project cx.toml. Use ~/.config/cx/cx.toml instead.",
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
