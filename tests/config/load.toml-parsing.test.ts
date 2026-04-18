// test-lane: integration
import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import { loadCxConfig } from "../../src/config/load.js";
import { createWorkspace } from "../helpers/workspace/createWorkspace.js";

async function writeRawConfig(content: string): Promise<string> {
  const workspace = await createWorkspace({ fixture: "minimal" });
  await fs.writeFile(workspace.configPath, content, "utf8");
  return workspace.configPath;
}

function buildToml(
  opts: {
    repomixExtra?: string;
    dedupExtra?: string;
    configExtra?: string;
    assetsExtra?: string;
    sections?: string;
  } = {},
): string {
  const {
    repomixExtra = "",
    dedupExtra = "",
    configExtra = "",
    assetsExtra = "",
    sections = `[sections.src]\ninclude = ["src/**"]\nexclude = []\n`,
  } = opts;

  const parts: string[] = [
    `schema_version = 1`,
    `project_name = "demo"`,
    `source_root = "."`,
    `output_dir = "dist/demo-bundle"`,
    ``,
    `[repomix]`,
    `style = "xml"`,
    ...(repomixExtra ? [repomixExtra] : []),
    ``,
  ];

  if (dedupExtra) {
    parts.push(`[dedup]`, dedupExtra, ``);
  }
  if (configExtra) {
    parts.push(`[config]`, configExtra, ``);
  }
  if (assetsExtra) {
    parts.push(`[assets]`, assetsExtra, ``);
  }

  parts.push(sections);
  return parts.join("\n");
}

describe("loadCxConfig TOML parsing", () => {
  test("rejects output extension values without a leading dot", async () => {
    const configPath = await writeRawConfig(`schema_version = 1
project_name = "demo"
source_root = "."
output_dir = "dist/demo-bundle"

[output.extensions]
json = "json.txt"

[repomix]
style = "xml"

[sections.src]
include = ["src/**"]
exclude = []
`);

    await expect(loadCxConfig(configPath)).rejects.toThrow(
      "output.extensions.json must start with '.'.",
    );
  });

  test("rejects project-level display settings", async () => {
    const configPath = await writeRawConfig(`schema_version = 1
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
`);

    await expect(loadCxConfig(configPath)).rejects.toThrow(
      "display settings are no longer supported in project cx.toml. Use ~/.config/cx/cx.toml instead.",
    );
  });

  test("fails when a config path references an undefined environment variable", async () => {
    delete process.env.CX_MISSING_OUTPUT_DIR;
    const configPath = await writeRawConfig(`schema_version = 1
project_name = "demo"
source_root = "."
output_dir = "$CX_MISSING_OUTPUT_DIR/demo-bundle"

[repomix]
style = "xml"

[sections.src]
include = ["src/**"]
exclude = []
`);

    await expect(loadCxConfig(configPath)).rejects.toThrow(
      "output_dir references undefined environment variable CX_MISSING_OUTPUT_DIR.",
    );
  });

  test("rejects an invalid assets.layout value", async () => {
    const configPath = await writeRawConfig(
      buildToml({ assetsExtra: `layout = "sideways"` }),
    );
    await expect(loadCxConfig(configPath)).rejects.toThrow(
      "assets.layout must be one of: flat, deep.",
    );
  });

  test("rejects a non-integer section priority", async () => {
    const configPath = await writeRawConfig(`schema_version = 1
project_name = "demo"
source_root = "."
output_dir = "dist/demo-bundle"

[repomix]
style = "xml"

[sections.src]
include = ["src/**"]
exclude = []
priority = 1.5
`);

    await expect(loadCxConfig(configPath)).rejects.toThrow(
      "sections.src.priority must be a positive integer.",
    );
  });

  test("compiled default is used when no env or file value is set", async () => {
    const configPath = await writeRawConfig(buildToml());
    const config = await loadCxConfig(configPath, {});
    expect(config.dedup.mode).toBe("fail");
    expect(config.behavior.repomixMissingExtension).toBe("warn");
    expect(config.behavior.configDuplicateEntry).toBe("fail");
  });

  test("cx.toml values override compiled defaults", async () => {
    const configPath = await writeRawConfig(
      buildToml({
        repomixExtra: `missing_extension = "fail"`,
        dedupExtra: `mode = "warn"`,
        configExtra: `duplicate_entry = "first-wins"`,
      }),
    );
    const config = await loadCxConfig(configPath, {});
    expect(config.dedup.mode).toBe("warn");
    expect(config.behavior.repomixMissingExtension).toBe("fail");
    expect(config.behavior.configDuplicateEntry).toBe("first-wins");
  });

  test("env overrides win over file values", async () => {
    const configPath = await writeRawConfig(
      buildToml({ dedupExtra: `mode = "warn"` }),
    );
    const config = await loadCxConfig(configPath, { dedupMode: "first-wins" });
    expect(config.dedup.mode).toBe("first-wins");
  });

  test("CLI overrides win over env overrides for assets.layout", async () => {
    const configPath = await writeRawConfig(
      buildToml({ assetsExtra: `layout = "deep"` }),
    );
    const config = await loadCxConfig(
      configPath,
      { assetsLayout: "flat" },
      { assetsLayout: "deep" },
    );
    expect(config.assets.layout).toBe("deep");
    expect(config.behaviorSources.assetsLayout).toBe("cli flag");
  });

  test("rejects invalid dedup.mode values", async () => {
    const configPath = await writeRawConfig(
      buildToml({ dedupExtra: `mode = "silent"` }),
    );
    await expect(loadCxConfig(configPath, {})).rejects.toThrow(
      "dedup.mode must be one of: fail, warn, first-wins.",
    );
  });

  test("rejects invalid repomix.missing_extension values", async () => {
    const configPath = await writeRawConfig(
      buildToml({ repomixExtra: `missing_extension = "ignore"` }),
    );
    await expect(loadCxConfig(configPath, {})).rejects.toThrow(
      "repomix.missing_extension must be one of: fail, warn.",
    );
  });

  test("rejects invalid config.duplicate_entry values", async () => {
    const configPath = await writeRawConfig(
      buildToml({ configExtra: `duplicate_entry = "skip"` }),
    );
    await expect(loadCxConfig(configPath, {})).rejects.toThrow(
      "config.duplicate_entry must be one of: fail, warn, first-wins.",
    );
  });

  test("deduplicates include patterns when first-wins is selected", async () => {
    const configPath = await writeRawConfig(
      buildToml({
        sections: `[sections.src]\ninclude = ["src/**", "src/**", "lib/**"]\nexclude = []\n`,
      }),
    );
    const config = await loadCxConfig(configPath, {
      configDuplicateEntry: "first-wins",
    });
    expect(config.sections.src?.include).toEqual(["src/**", "lib/**"]);
  });

  test("fails on duplicate patterns in files.exclude", async () => {
    const configPath = await writeRawConfig(`schema_version = 1
project_name = "demo"
source_root = "."
output_dir = "dist/demo-bundle"

[repomix]
style = "xml"

[files]
exclude = [".git/**", ".git/**", "node_modules/**"]

[sections.src]
include = ["src/**"]
exclude = []
`);

    await expect(
      loadCxConfig(configPath, { configDuplicateEntry: "fail" }),
    ).rejects.toThrow(
      'files.exclude contains duplicate pattern(s): ".git/**".',
    );
  });

  test("fails on duplicate patterns in assets.exclude", async () => {
    const configPath = await writeRawConfig(`schema_version = 1
project_name = "demo"
source_root = "."
output_dir = "dist/demo-bundle"

[repomix]
style = "xml"

[assets]
include = ["**/*.png"]
exclude = ["test/**", "test/**"]

[sections.src]
include = ["src/**"]
exclude = []
`);

    await expect(
      loadCxConfig(configPath, { configDuplicateEntry: "fail" }),
    ).rejects.toThrow(
      'assets.exclude contains duplicate pattern(s): "test/**".',
    );
  });

  test("rejects a catch_all section that also specifies include patterns", async () => {
    const configPath = await writeRawConfig(`schema_version = 1
project_name = "demo"
source_root = "."
output_dir = "dist/demo-bundle"

[repomix]
style = "xml"

[sections.src]
include = ["src/**"]
exclude = []

[sections.other]
catch_all = true
include = ["docs/**"]
exclude = []
`);

    await expect(loadCxConfig(configPath)).rejects.toThrow(
      "sections.other: catch_all sections must not specify include patterns.",
    );
  });

  test("rejects a normal section with an empty include array", async () => {
    const configPath = await writeRawConfig(`schema_version = 1
project_name = "demo"
source_root = "."
output_dir = "dist/demo-bundle"

[repomix]
style = "xml"

[sections.src]
include = []
exclude = []
`);

    await expect(loadCxConfig(configPath)).rejects.toThrow(
      "sections.src.include must contain at least one pattern (or set catch_all = true).",
    );
  });
});
