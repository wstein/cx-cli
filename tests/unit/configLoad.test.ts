// test-lane: unit

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { loadCxConfig } from "../../src/config/load.js";
import { CxError } from "../../src/shared/errors.js";

const MIN_VALID = `schema_version = 1
project_name = "proj"
source_root = "."
output_dir = "dist/proj"

[sections.main]
include = ["src/**"]
exclude = []
`;

let testDir: string;

beforeEach(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-load-test-"));
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
  delete process.env.CX_STRICT;
  delete process.env.TEST_CX_SRC;
});

async function write(name: string, content: string): Promise<string> {
  const p = path.join(testDir, name);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content, "utf8");
  return p;
}

describe("loadCxConfig", () => {
  test("minimal valid config loads successfully", async () => {
    const p = await write("cx.toml", MIN_VALID);
    const config = await loadCxConfig(p, {}, {});
    expect(config.projectName).toBe("proj");
    expect(config.schemaVersion).toBe(1);
    expect(config.sections.main).toBeDefined();
  });

  test("all default fields are populated", async () => {
    const p = await write("cx.toml", MIN_VALID);
    const config = await loadCxConfig(p, {}, {});
    expect(config.repomix.style).toBe("xml");
    expect(config.dedup.mode).toBe("fail");
    expect(config.manifest.pretty).toBe(true);
    expect(config.mcp.policy).toBe("default");
  });

  test("schema_version = 2 → CxError", async () => {
    const p = await write(
      "cx.toml",
      `schema_version = 2
project_name = "proj"
source_root = "."
output_dir = "dist/proj"
[sections.main]
include = ["src/**"]
`,
    );
    await expect(loadCxConfig(p, {}, {})).rejects.toThrow(CxError);
  });

  test("missing schema_version → CxError", async () => {
    const p = await write(
      "cx.toml",
      `project_name = "proj"
source_root = "."
output_dir = "dist/proj"
[sections.main]
include = ["src/**"]
`,
    );
    await expect(loadCxConfig(p, {}, {})).rejects.toThrow(CxError);
  });

  test("missing project_name → CxError", async () => {
    const p = await write(
      "cx.toml",
      `schema_version = 1
source_root = "."
output_dir = "dist/proj"
[sections.main]
include = ["src/**"]
`,
    );
    await expect(loadCxConfig(p, {}, {})).rejects.toThrow(CxError);
  });

  test("empty sections table → CxError", async () => {
    const p = await write(
      "cx.toml",
      `schema_version = 1
project_name = "proj"
source_root = "."
output_dir = "dist/proj"
`,
    );
    await expect(loadCxConfig(p, {}, {})).rejects.toThrow(CxError);
  });

  test("reserved section name 'manifest' → CxError", async () => {
    const p = await write(
      "cx.toml",
      `schema_version = 1
project_name = "proj"
source_root = "."
output_dir = "dist/proj"
[sections.manifest]
include = ["src/**"]
exclude = []
`,
    );
    await expect(loadCxConfig(p, {}, {})).rejects.toThrow(CxError);
  });

  test("reserved section name 'bundle' → CxError", async () => {
    const p = await write(
      "cx.toml",
      `schema_version = 1
project_name = "proj"
source_root = "."
output_dir = "dist/proj"
[sections.bundle]
include = ["src/**"]
exclude = []
`,
    );
    await expect(loadCxConfig(p, {}, {})).rejects.toThrow(CxError);
  });

  test("reserved section name 'assets' → CxError", async () => {
    const p = await write(
      "cx.toml",
      `schema_version = 1
project_name = "proj"
source_root = "."
output_dir = "dist/proj"
[sections.assets]
include = ["src/**"]
exclude = []
`,
    );
    await expect(loadCxConfig(p, {}, {})).rejects.toThrow(CxError);
  });

  test("catch_all section with include → CxError", async () => {
    const p = await write(
      "cx.toml",
      `schema_version = 1
project_name = "proj"
source_root = "."
output_dir = "dist/proj"
[sections.main]
catch_all = true
include = ["src/**"]
exclude = []
`,
    );
    await expect(loadCxConfig(p, {}, {})).rejects.toThrow(CxError);
  });

  test("catch_all = true without include → succeeds", async () => {
    const p = await write(
      "cx.toml",
      `schema_version = 1
project_name = "proj"
source_root = "."
output_dir = "dist/proj"
[sections.main]
catch_all = true
exclude = []
`,
    );
    const config = await loadCxConfig(p, {}, {});
    expect(config.sections.main?.catch_all).toBe(true);
    expect(config.sections.main?.include).toBeUndefined();
  });

  test("invalid repomix.style → CxError", async () => {
    const p = await write(
      "cx.toml",
      `schema_version = 1
project_name = "proj"
source_root = "."
output_dir = "dist/proj"
[repomix]
style = "invalid_style"
[sections.main]
include = ["src/**"]
exclude = []
`,
    );
    await expect(loadCxConfig(p, {}, {})).rejects.toThrow(CxError);
  });

  test("display field present → CxError", async () => {
    const p = await write(
      "cx.toml",
      `schema_version = 1
project_name = "proj"
source_root = "."
output_dir = "dist/proj"
[display]
something = true
[sections.main]
include = ["src/**"]
exclude = []
`,
    );
    await expect(loadCxConfig(p, {}, {})).rejects.toThrow(CxError);
  });

  test("section include = [] without catch_all → CxError", async () => {
    const p = await write(
      "cx.toml",
      `schema_version = 1
project_name = "proj"
source_root = "."
output_dir = "dist/proj"
[sections.main]
include = []
exclude = []
`,
    );
    await expect(loadCxConfig(p, {}, {})).rejects.toThrow(CxError);
  });

  test("section priority = 1.5 (float) → CxError", async () => {
    const p = await write(
      "cx.toml",
      `schema_version = 1
project_name = "proj"
source_root = "."
output_dir = "dist/proj"
[sections.main]
include = ["src/**"]
exclude = []
priority = 1.5
`,
    );
    await expect(loadCxConfig(p, {}, {})).rejects.toThrow(CxError);
  });

  test("section priority = 2 (valid int) → stored in config", async () => {
    const p = await write(
      "cx.toml",
      `schema_version = 1
project_name = "proj"
source_root = "."
output_dir = "dist/proj"
[sections.main]
include = ["src/**"]
exclude = []
priority = 2
`,
    );
    const config = await loadCxConfig(p, {}, {});
    expect(config.sections.main?.priority).toBe(2);
  });

  test("dedup.mode from compiled default → source is 'compiled default'", async () => {
    const p = await write("cx.toml", MIN_VALID);
    const config = await loadCxConfig(p, {}, {});
    expect(config.dedup.mode).toBe("fail");
    expect(config.behaviorSources.dedupMode).toBe("compiled default");
  });

  test("dedup.mode from cx.toml → source is 'cx.toml'", async () => {
    const p = await write(
      "cx.toml",
      `schema_version = 1
project_name = "proj"
source_root = "."
output_dir = "dist/proj"
[dedup]
mode = "warn"
[sections.main]
include = ["src/**"]
exclude = []
`,
    );
    const config = await loadCxConfig(p, {}, {});
    expect(config.dedup.mode).toBe("warn");
    expect(config.behaviorSources.dedupMode).toBe("cx.toml");
  });

  test("dedup.mode env override → source is 'env var'", async () => {
    const p = await write("cx.toml", MIN_VALID);
    const config = await loadCxConfig(p, { dedupMode: "warn" }, {});
    expect(config.dedup.mode).toBe("warn");
    expect(config.behaviorSources.dedupMode).toBe("env var");
  });

  test("dedup.mode CLI override → takes precedence over env, source is 'cli flag'", async () => {
    const p = await write("cx.toml", MIN_VALID);
    const config = await loadCxConfig(
      p,
      { dedupMode: "warn" },
      { dedupMode: "first-wins" },
    );
    expect(config.dedup.mode).toBe("first-wins");
    expect(config.behaviorSources.dedupMode).toBe("cli flag");
  });

  test("CX_STRICT env + env override → source is 'CX_STRICT'", async () => {
    process.env.CX_STRICT = "true";
    const p = await write("cx.toml", MIN_VALID);
    const config = await loadCxConfig(p, { dedupMode: "fail" }, {});
    expect(config.behaviorSources.dedupMode).toBe("CX_STRICT");
  });

  test("~ in output_dir → expands to home directory", async () => {
    const p = await write(
      "cx.toml",
      `schema_version = 1
project_name = "proj"
source_root = "."
output_dir = "~/dist/proj"
[sections.main]
include = ["src/**"]
exclude = []
`,
    );
    const config = await loadCxConfig(p, {}, {});
    expect(config.outputDir).not.toContain("~");
    expect(config.outputDir).toContain("dist/proj");
  });

  test("$ENV_VAR in source_root → expanded to env value", async () => {
    process.env.TEST_CX_SRC = testDir;
    const p = await write(
      "cx.toml",
      `schema_version = 1
project_name = "proj"
source_root = "$TEST_CX_SRC"
output_dir = "dist/proj"
[sections.main]
include = ["src/**"]
exclude = []
`,
    );
    const config = await loadCxConfig(p, {}, {});
    expect(config.sourceRoot).toBe(testDir);
  });

  test("undefined $ENV_VAR in source_root → CxError", async () => {
    delete process.env.UNDEFINED_CX_XYZ_VAR;
    const p = await write(
      "cx.toml",
      `schema_version = 1
project_name = "proj"
source_root = "$UNDEFINED_CX_XYZ_VAR"
output_dir = "dist/proj"
[sections.main]
include = ["src/**"]
exclude = []
`,
    );
    await expect(loadCxConfig(p, {}, {})).rejects.toThrow(CxError);
  });

  test("{project} in checksums.file_name → substituted with projectName", async () => {
    const p = await write("cx.toml", MIN_VALID);
    const config = await loadCxConfig(p, {}, {});
    expect(config.checksums.fileName).toBe("proj.sha256");
  });

  test("extends resolves and merges base config", async () => {
    await write(
      "base.toml",
      `schema_version = 1
project_name = "base-proj"
source_root = "."
output_dir = "dist/base"
[sections.main]
include = ["src/**"]
exclude = []
`,
    );
    const p = await write(
      "cx.toml",
      `extends = "base.toml"
project_name = "child-proj"
`,
    );
    const config = await loadCxConfig(p, {}, {});
    expect(config.projectName).toBe("child-proj");
    expect(config.sections.main).toBeDefined();
  });

  test("deep extends chain (extends in base) → CxError", async () => {
    await write(
      "grandparent.toml",
      `schema_version = 1
project_name = "gp"
source_root = "."
output_dir = "dist/gp"
[sections.main]
include = ["src/**"]
exclude = []
`,
    );
    await write(
      "base.toml",
      `extends = "grandparent.toml"
project_name = "base"
`,
    );
    const p = await write(
      "cx.toml",
      `extends = "base.toml"
project_name = "child"
`,
    );
    await expect(loadCxConfig(p, {}, {})).rejects.toThrow(CxError);
  });

  test("duplicate include patterns default mode (fail) → CxError", async () => {
    const p = await write(
      "cx.toml",
      `schema_version = 1
project_name = "proj"
source_root = "."
output_dir = "dist/proj"
[sections.main]
include = ["src/**", "src/**"]
exclude = []
`,
    );
    await expect(loadCxConfig(p, {}, {})).rejects.toThrow(CxError);
  });

  test("duplicate include patterns mode=first-wins → silently deduped", async () => {
    const p = await write(
      "cx.toml",
      `schema_version = 1
project_name = "proj"
source_root = "."
output_dir = "dist/proj"
[config]
duplicate_entry = "first-wins"
[sections.main]
include = ["src/**", "src/**"]
exclude = []
`,
    );
    const config = await loadCxConfig(p, {}, {});
    expect(config.sections.main?.include).toEqual(["src/**"]);
  });

  test("output.extensions custom xml value → parsed", async () => {
    const p = await write(
      "cx.toml",
      `schema_version = 1
project_name = "proj"
source_root = "."
output_dir = "dist/proj"
[output.extensions]
xml = ".repomix"
[sections.main]
include = ["src/**"]
exclude = []
`,
    );
    const config = await loadCxConfig(p, {}, {});
    expect(config.output.extensions.xml).toBe(".repomix");
  });

  test("output.extensions unknown key → CxError", async () => {
    const p = await write(
      "cx.toml",
      `schema_version = 1
project_name = "proj"
source_root = "."
output_dir = "dist/proj"
[output.extensions]
unknown = ".txt"
[sections.main]
include = ["src/**"]
exclude = []
`,
    );
    await expect(loadCxConfig(p, {}, {})).rejects.toThrow(CxError);
  });

  test("output.extensions value without leading dot → CxError", async () => {
    const p = await write(
      "cx.toml",
      `schema_version = 1
project_name = "proj"
source_root = "."
output_dir = "dist/proj"
[output.extensions]
xml = "txt"
[sections.main]
include = ["src/**"]
exclude = []
`,
    );
    await expect(loadCxConfig(p, {}, {})).rejects.toThrow(CxError);
  });

  test("section with per-section style override → stored", async () => {
    const p = await write(
      "cx.toml",
      `schema_version = 1
project_name = "proj"
source_root = "."
output_dir = "dist/proj"
[sections.main]
include = ["src/**"]
exclude = []
style = "markdown"
`,
    );
    const config = await loadCxConfig(p, {}, {});
    expect(config.sections.main?.style).toBe("markdown");
  });

  test("mcp.policy explicit value → stored", async () => {
    const p = await write(
      "cx.toml",
      `schema_version = 1
project_name = "proj"
source_root = "."
output_dir = "dist/proj"
[mcp]
policy = "strict"
audit_logging = false
[sections.main]
include = ["src/**"]
exclude = []
`,
    );
    const config = await loadCxConfig(p, {}, {});
    expect(config.mcp.policy).toBe("strict");
    expect(config.mcp.auditLogging).toBe(false);
  });
});
