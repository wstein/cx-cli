// test-lane: integration
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { loadCxConfig } from "../../src/config/load.js";
import { buildConfig } from "../helpers/config/buildConfig.js";
import { toToml } from "../helpers/config/toToml.js";
import { createWorkspace } from "../helpers/workspace/createWorkspace.js";

let configPath = "";
let rootDir = "";

beforeAll(async () => {
  const workspace = await createWorkspace({
    fixture: "minimal",
    config: buildConfig(),
  });
  configPath = workspace.configPath;
  rootDir = workspace.rootDir;
});

afterAll(async () => {
  if (rootDir.length > 0) {
    await fs.rm(rootDir, { recursive: true, force: true });
  }
});

async function loadConfig(
  overrides: Partial<ReturnType<typeof buildConfig>> = {},
) {
  const config = buildConfig(overrides);
  await fs.writeFile(configPath, toToml(config), "utf8");
  return loadCxConfig(configPath);
}

describe("loadCxConfig object model", () => {
  test("loads a valid config and applies defaults", async () => {
    const config = await loadConfig();
    expect(config.projectName).toBe("demo");
    expect(config.assets.targetDir).toBe("demo-assets");
    expect(config.assets.layout).toBe("flat");
    expect(config.checksums.fileName).toBe("demo.sha256");
    expect(config.tokens.encoding).toBe("o200k_base");
    expect(config.output.extensions).toEqual({
      xml: ".xml.txt",
      json: ".json.txt",
      markdown: ".md",
      plain: ".txt",
    });
    expect(config.sections.src?.include).toEqual(["src/**"]);
  });

  test("loads custom output extension overrides", async () => {
    const config = await loadConfig({
      output: {
        extensions: {
          xml: ".xml.bundle.txt",
          json: ".json.bundle.txt",
          markdown: ".md",
          plain: ".txt",
        },
      },
    });

    expect(config.output.extensions).toEqual({
      xml: ".xml.bundle.txt",
      json: ".json.bundle.txt",
      markdown: ".md",
      plain: ".txt",
    });
  });

  test("loads token encoding overrides", async () => {
    const config = await loadConfig({
      tokens: { encoding: "cl100k_base" },
    });

    expect(config.tokens.encoding).toBe("cl100k_base");
  });

  test("expands tilde and environment variables in config paths", async () => {
    const previousOutputBase = process.env.CX_OUTPUT_BASE;
    const tempOutputBase = path.join(os.tmpdir(), "cx-config-output-base");
    process.env.CX_OUTPUT_BASE = tempOutputBase;

    try {
      const config = await loadConfig({
        sourceRoot: `\${HOME}/workspace`,
        outputDir: "$CX_OUTPUT_BASE/{project}",
      });

      expect(config.sourceRoot).toBe(path.join(os.homedir(), "workspace"));
      expect(config.outputDir).toBe(path.join(tempOutputBase, "demo"));
    } finally {
      process.env.CX_OUTPUT_BASE = previousOutputBase;
    }
  });

  test("expands a leading tilde in output_dir", async () => {
    const config = await loadConfig({
      outputDir: "~/Downloads/demo-bundle",
    });

    expect(config.outputDir).toBe(
      path.join(os.homedir(), "Downloads/demo-bundle"),
    );
  });

  test("expands the project token in checksum and asset paths", async () => {
    const config = await loadConfig({
      checksums: {
        fileName: "{project}.lock",
      },
      assets: {
        targetDir: "{project}-assets",
      },
    });

    expect(config.checksums.fileName).toBe("demo.lock");
    expect(config.assets.targetDir).toBe("demo-assets");
  });

  test("loads section priority from config", async () => {
    const config = await loadConfig({
      sections: {
        src: {
          include: ["src/**"],
          exclude: [],
          priority: 10,
        },
      },
    });

    expect(config.sections.src?.priority).toBe(10);
  });

  test("loads assets.layout = deep from config", async () => {
    const config = await loadConfig({
      assets: { layout: "deep" },
    });

    expect(config.assets.layout).toBe("deep");
    expect(config.behaviorSources.assetsLayout).toBe("cx.toml");
  });

  test("loads a catch_all section without include patterns", async () => {
    const config = await loadConfig({
      sections: {
        src: {
          include: ["src/**"],
          exclude: [],
        },
        other: {
          exclude: [],
          catchAll: true,
        },
      },
    });

    expect(config.sections.other?.catch_all).toBe(true);
    expect(config.sections.other?.include).toBeUndefined();
    expect(config.sections.src?.include).toEqual(["src/**"]);
  });

  test("files.include defaults to an empty array", async () => {
    const config = await loadConfig();
    expect(config.files.include).toEqual([]);
  });

  test("loads files.include patterns from config", async () => {
    const config = await loadConfig({
      files: {
        include: ["generated/**", "dist-public/**"],
        exclude: [],
      },
    });

    expect(config.files.include).toEqual(["generated/**", "dist-public/**"]);
  });
});
