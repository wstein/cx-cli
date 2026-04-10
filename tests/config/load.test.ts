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
    expect(config.sections.src?.include).toEqual(["src/**"]);
  });
});
