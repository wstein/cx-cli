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
    expect(config.assets.layout).toBe("flat");
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

  test("loads section priority from cx.toml", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-config-priority-"),
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

[sections.src]
include = ["src/**"]
exclude = []
priority = 10

[sections.tests]
include = ["tests/**"]
exclude = []
`,
      "utf8",
    );

    const config = await loadCxConfig(configPath);
    expect(config.sections.src?.priority).toBe(10);
    expect(config.sections.tests?.priority).toBeUndefined();
  });

  test("loads assets.layout = deep from cx.toml", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-config-layout-"),
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

[assets]
layout = "deep"

[sections.src]
include = ["src/**"]
exclude = []
`,
      "utf8",
    );

    const config = await loadCxConfig(configPath);
    expect(config.assets.layout).toBe("deep");
  });

  test("rejects an invalid assets.layout value", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-config-layout-bad-"),
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

[assets]
layout = "hierarchical"

[sections.src]
include = ["src/**"]
exclude = []
`,
      "utf8",
    );

    await expect(loadCxConfig(configPath)).rejects.toThrow(
      "assets.layout must be one of: flat, deep.",
    );
  });

  test("rejects a non-integer section priority", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-config-priority-bad-"),
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

[sections.src]
include = ["src/**"]
exclude = []
priority = 0
`,
      "utf8",
    );

    await expect(loadCxConfig(configPath)).rejects.toThrow(
      "sections.src.priority must be a positive integer.",
    );
  });
});

// ---------------------------------------------------------------------------
// Behavioral settings — precedence chain and modes
// ---------------------------------------------------------------------------

/**
 * Build a minimal cx.toml string. Accepts optional overrides for each
 * top-level table so that tests can customise individual tables without
 * creating duplicate TOML headers.
 */
function buildToml(
  opts: {
    repomixExtra?: string;
    dedupExtra?: string;
    configExtra?: string;
    sections?: string;
  } = {},
): string {
  const {
    repomixExtra = "",
    dedupExtra = "",
    configExtra = "",
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

  parts.push(sections);
  return parts.join("\n");
}

async function writeCxToml(dir: string, content: string): Promise<string> {
  const configPath = path.join(dir, "cx.toml");
  await fs.writeFile(configPath, content, "utf8");
  return configPath;
}

describe("behavioral settings — precedence chain", () => {
  test("compiled default is used when no env or file value is set", async () => {
    const dir = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-behavior-default-"),
    );
    const configPath = await writeCxToml(dir, buildToml());
    const config = await loadCxConfig(configPath, {});
    expect(config.dedup.mode).toBe("fail");
    expect(config.behavior.repomixMissingExtension).toBe("warn");
    expect(config.behavior.configDuplicateEntry).toBe("fail");
  });

  test("cx.toml value overrides compiled default", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-behavior-file-"));
    const configPath = await writeCxToml(
      dir,
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

  test("env override wins over cx.toml value", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-behavior-env-"));
    const configPath = await writeCxToml(
      dir,
      buildToml({ dedupExtra: `mode = "warn"` }),
    );
    const config = await loadCxConfig(configPath, { dedupMode: "first-wins" });
    expect(config.dedup.mode).toBe("first-wins");
  });

  test("CX_STRICT override sets all Category B to fail, overriding cx.toml", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-behavior-strict-"));
    const configPath = await writeCxToml(
      dir,
      buildToml({
        repomixExtra: `missing_extension = "warn"`,
        dedupExtra: `mode = "warn"`,
        configExtra: `duplicate_entry = "first-wins"`,
      }),
    );
    // Simulate CX_STRICT=true by passing fully-populated overrides (all fail).
    const config = await loadCxConfig(configPath, {
      dedupMode: "fail",
      repomixMissingExtension: "fail",
      configDuplicateEntry: "fail",
    });
    expect(config.dedup.mode).toBe("fail");
    expect(config.behavior.repomixMissingExtension).toBe("fail");
    expect(config.behavior.configDuplicateEntry).toBe("fail");
  });

  test("dedup.mode=warn is accepted in cx.toml", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-dedup-warn-"));
    const configPath = await writeCxToml(
      dir,
      buildToml({ dedupExtra: `mode = "warn"` }),
    );
    const config = await loadCxConfig(configPath, {});
    expect(config.dedup.mode).toBe("warn");
  });

  test("rejects an invalid dedup.mode value", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-dedup-invalid-"));
    const configPath = await writeCxToml(
      dir,
      buildToml({ dedupExtra: `mode = "silent"` }),
    );
    await expect(loadCxConfig(configPath, {})).rejects.toThrow(
      "dedup.mode must be one of: fail, warn, first-wins.",
    );
  });

  test("rejects an invalid repomix.missing_extension value", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-repomix-invalid-"));
    const configPath = await writeCxToml(
      dir,
      buildToml({ repomixExtra: `missing_extension = "ignore"` }),
    );
    await expect(loadCxConfig(configPath, {})).rejects.toThrow(
      "repomix.missing_extension must be one of: fail, warn.",
    );
  });

  test("rejects an invalid config.duplicate_entry value", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-dup-invalid-"));
    const configPath = await writeCxToml(
      dir,
      buildToml({ configExtra: `duplicate_entry = "skip"` }),
    );
    await expect(loadCxConfig(configPath, {})).rejects.toThrow(
      "config.duplicate_entry must be one of: fail, warn, first-wins.",
    );
  });
});

describe("behavioral settings — duplicate pattern detection", () => {
  test("fails on duplicate include patterns when config.duplicate_entry=fail", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-dup-fail-"));
    const configPath = await writeCxToml(
      dir,
      buildToml({
        sections: `[sections.src]\ninclude = ["src/**", "src/**"]\nexclude = []\n`,
      }),
    );
    await expect(
      loadCxConfig(configPath, { configDuplicateEntry: "fail" }),
    ).rejects.toThrow(
      'sections.src.include contains duplicate pattern(s): "src/**".',
    );
  });

  test("deduplicates silently when config.duplicate_entry=first-wins", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-dup-firstwins-"));
    const configPath = await writeCxToml(
      dir,
      buildToml({
        sections: `[sections.src]\ninclude = ["src/**", "src/**", "lib/**"]\nexclude = []\n`,
      }),
    );
    const config = await loadCxConfig(configPath, {
      configDuplicateEntry: "first-wins",
    });
    expect(config.sections.src?.include).toEqual(["src/**", "lib/**"]);
  });

  test("deduplicates with warning when config.duplicate_entry=warn", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-dup-warn-"));
    const configPath = await writeCxToml(
      dir,
      buildToml({
        sections: `[sections.src]\ninclude = ["src/**", "src/**"]\nexclude = []\n`,
      }),
    );
    const config = await loadCxConfig(configPath, {
      configDuplicateEntry: "warn",
    });
    expect(config.sections.src?.include).toEqual(["src/**"]);
  });

  test("no error when there are no duplicate patterns", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-dup-none-"));
    const configPath = await writeCxToml(
      dir,
      buildToml({
        sections: `[sections.src]\ninclude = ["src/**", "lib/**"]\nexclude = []\n`,
      }),
    );
    const config = await loadCxConfig(configPath, {
      configDuplicateEntry: "fail",
    });
    expect(config.sections.src?.include).toEqual(["src/**", "lib/**"]);
  });

  test("detects duplicates in exclude arrays too", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-dup-exclude-"));
    const configPath = await writeCxToml(
      dir,
      buildToml({
        sections: `[sections.src]\ninclude = ["src/**"]\nexclude = ["dist/**", "dist/**"]\n`,
      }),
    );
    await expect(
      loadCxConfig(configPath, { configDuplicateEntry: "fail" }),
    ).rejects.toThrow(
      'sections.src.exclude contains duplicate pattern(s): "dist/**".',
    );
  });
});

describe("behavioral settings — duplicate detection in global arrays", () => {
  test("fails on duplicate patterns in files.exclude", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-dup-files-"));
    const configPath = await writeCxToml(
      dir,
      buildToml({
        // Provide [files] with duplicates as extra content before sections.
        // We use a custom TOML build without the files block going through
        // buildToml's repomix table to keep the TOML valid.
      }),
    );
    // Write the file manually so we can control the files.exclude array.
    await fs.writeFile(
      configPath,
      `schema_version = 1
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
`,
      "utf8",
    );
    await expect(
      loadCxConfig(configPath, { configDuplicateEntry: "fail" }),
    ).rejects.toThrow(
      'files.exclude contains duplicate pattern(s): ".git/**".',
    );
  });

  test("deduplicates files.exclude silently when config.duplicate_entry=first-wins", async () => {
    const dir = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-dup-files-firstwins-"),
    );
    const configPath = path.join(dir, "cx.toml");
    await fs.writeFile(
      configPath,
      `schema_version = 1
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
`,
      "utf8",
    );
    const config = await loadCxConfig(configPath, {
      configDuplicateEntry: "first-wins",
    });
    expect(config.files.exclude).toEqual([".git/**", "node_modules/**"]);
  });

  test("fails on duplicate patterns in assets.include", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-dup-assets-inc-"));
    const configPath = path.join(dir, "cx.toml");
    await fs.writeFile(
      configPath,
      `schema_version = 1
project_name = "demo"
source_root = "."
output_dir = "dist/demo-bundle"

[repomix]
style = "xml"

[assets]
include = ["**/*.png", "**/*.png", "**/*.jpg"]

[sections.src]
include = ["src/**"]
exclude = []
`,
      "utf8",
    );
    await expect(
      loadCxConfig(configPath, { configDuplicateEntry: "fail" }),
    ).rejects.toThrow(
      'assets.include contains duplicate pattern(s): "**/*.png".',
    );
  });

  test("fails on duplicate patterns in assets.exclude", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-dup-assets-exc-"));
    const configPath = path.join(dir, "cx.toml");
    await fs.writeFile(
      configPath,
      `schema_version = 1
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
`,
      "utf8",
    );
    await expect(
      loadCxConfig(configPath, { configDuplicateEntry: "fail" }),
    ).rejects.toThrow(
      'assets.exclude contains duplicate pattern(s): "test/**".',
    );
  });
});
