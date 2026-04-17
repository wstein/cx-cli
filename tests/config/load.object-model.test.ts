import { describe, expect, test } from "bun:test";
import os from "node:os";
import path from "node:path";
import { loadCxConfig } from "../../src/config/load.js";
import { buildConfig } from "../helpers/config/buildConfig.js";
import { createWorkspace } from "../helpers/workspace/createWorkspace.js";

describe("loadCxConfig object model", () => {
  test("loads a valid config and applies defaults", async () => {
    const workspace = await createWorkspace({
      fixture: "minimal",
      config: buildConfig(),
    });

    const config = await loadCxConfig(workspace.configPath);
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
    const workspace = await createWorkspace({
      fixture: "minimal",
      config: buildConfig({
        output: {
          extensions: {
            xml: ".xml.bundle.txt",
            json: ".json.bundle.txt",
            markdown: ".md",
            plain: ".txt",
          },
        },
      }),
    });

    const config = await loadCxConfig(workspace.configPath);
    expect(config.output.extensions).toEqual({
      xml: ".xml.bundle.txt",
      json: ".json.bundle.txt",
      markdown: ".md",
      plain: ".txt",
    });
  });

  test("loads token encoding overrides", async () => {
    const workspace = await createWorkspace({
      fixture: "minimal",
      config: buildConfig({
        tokens: { encoding: "cl100k_base" },
      }),
    });

    const config = await loadCxConfig(workspace.configPath);
    expect(config.tokens.encoding).toBe("cl100k_base");
  });

  test("expands tilde and environment variables in config paths", async () => {
    const previousOutputBase = process.env.CX_OUTPUT_BASE;
    const tempOutputBase = path.join(os.tmpdir(), "cx-config-output-base");
    process.env.CX_OUTPUT_BASE = tempOutputBase;

    try {
      const workspace = await createWorkspace({
        fixture: "minimal",
        config: buildConfig({
          sourceRoot: "${HOME}/workspace",
          outputDir: "$CX_OUTPUT_BASE/{project}",
        }),
      });

      const config = await loadCxConfig(workspace.configPath);
      expect(config.sourceRoot).toBe(path.join(os.homedir(), "workspace"));
      expect(config.outputDir).toBe(path.join(tempOutputBase, "demo"));
    } finally {
      process.env.CX_OUTPUT_BASE = previousOutputBase;
    }
  });

  test("expands a leading tilde in output_dir", async () => {
    const workspace = await createWorkspace({
      fixture: "minimal",
      config: buildConfig({
        outputDir: "~/Downloads/demo-bundle",
      }),
    });

    const config = await loadCxConfig(workspace.configPath);
    expect(config.outputDir).toBe(path.join(os.homedir(), "Downloads/demo-bundle"));
  });

  test("loads section priority from config", async () => {
    const workspace = await createWorkspace({
      fixture: "minimal",
      config: buildConfig({
        sections: {
          src: {
            include: ["src/**"],
            exclude: [],
            priority: 10,
          },
        },
      }),
    });

    const config = await loadCxConfig(workspace.configPath);
    expect(config.sections.src?.priority).toBe(10);
  });

  test("loads assets.layout = deep from config", async () => {
    const workspace = await createWorkspace({
      fixture: "minimal",
      config: buildConfig({
        assets: { layout: "deep" },
      }),
    });

    const config = await loadCxConfig(workspace.configPath);
    expect(config.assets.layout).toBe("deep");
    expect(config.behaviorSources.assetsLayout).toBe("cx.toml");
  });

  test("loads a catch_all section without include patterns", async () => {
    const workspace = await createWorkspace({
      fixture: "minimal",
      config: buildConfig({
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
      }),
    });

    const config = await loadCxConfig(workspace.configPath);
    expect(config.sections.other?.catch_all).toBe(true);
    expect(config.sections.other?.include).toBeUndefined();
    expect(config.sections.src?.include).toEqual(["src/**"]);
  });

  test("files.include defaults to an empty array", async () => {
    const workspace = await createWorkspace({
      fixture: "minimal",
      config: buildConfig(),
    });

    const config = await loadCxConfig(workspace.configPath);
    expect(config.files.include).toEqual([]);
  });

  test("loads files.include patterns from config", async () => {
    const workspace = await createWorkspace({
      fixture: "minimal",
      config: buildConfig({
        files: {
          include: ["generated/**", "dist-public/**"],
          exclude: [],
        },
      }),
    });

    const config = await loadCxConfig(workspace.configPath);
    expect(config.files.include).toEqual(["generated/**", "dist-public/**"]);
  });
});