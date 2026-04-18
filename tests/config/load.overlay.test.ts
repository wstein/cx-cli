// test-lane: integration
import { describe, expect, test } from "bun:test";
import path from "node:path";
import { loadCxConfig } from "../../src/config/load.js";
import { buildConfig } from "../helpers/config/buildConfig.js";
import { buildOverlayConfig } from "../helpers/config/buildOverlayConfig.js";
import { createWorkspace } from "../helpers/workspace/createWorkspace.js";

describe("loadCxConfig overlays", () => {
  test("loads a one-level inherited config and concatenates arrays", async () => {
    const workspace = await createWorkspace({
      fixture: "minimal",
      config: buildConfig({
        files: {
          include: ["base/generated/**"],
          exclude: ["node_modules/**"],
        },
        sections: {
          src: {
            include: ["src/**"],
            exclude: ["src/generated/**"],
          },
          tests: {
            include: ["tests/**"],
            exclude: [],
          },
        },
      }),
      overlayConfig: buildOverlayConfig({
        files: {
          include: ["dist/**"],
          exclude: ["tests/**"],
        },
        sections: {
          src: {
            exclude: ["src/tmp/**"],
          },
        },
      }),
    });

    const config = await loadCxConfig(workspace.overlayConfigPath as string);
    expect(config.files.include).toEqual(["base/generated/**", "dist/**"]);
    expect(config.files.exclude).toEqual(["node_modules/**", "tests/**"]);
    expect(config.sections.src?.include).toEqual(["src/**"]);
    expect(config.sections.src?.exclude).toEqual([
      "src/generated/**",
      "src/tmp/**",
    ]);
    expect(config.sections.tests?.include).toEqual(["tests/**"]);
  });

  test("overlay config can tighten MCP policy", async () => {
    const workspace = await createWorkspace({
      fixture: "minimal",
      config: buildConfig({
        mcp: {
          policy: "default",
          auditLogging: true,
        },
      }),
      overlayConfig: buildOverlayConfig({
        mcp: {
          policy: "strict",
          auditLogging: false,
        },
      }),
    });

    const config = await loadCxConfig(workspace.overlayConfigPath as string);
    expect(config.mcp.policy).toBe("strict");
    expect(config.mcp.auditLogging).toBe(false);
  });

  test("overlay config can extend sections without replacing the base set", async () => {
    const workspace = await createWorkspace({
      fixture: "minimal",
      config: buildConfig({
        sections: {
          docs: {
            include: ["README.md"],
            exclude: [],
          },
          src: {
            include: ["src/**"],
            exclude: [],
          },
        },
      }),
      overlayConfig: buildOverlayConfig({
        sections: {
          repo: {
            include: ["package.json"],
            exclude: [],
          },
        },
      }),
    });

    const config = await loadCxConfig(workspace.overlayConfigPath as string);
    expect(Object.keys(config.sections)).toEqual(["docs", "src", "repo"]);
    expect(config.sections.repo?.include).toEqual(["package.json"]);
  });

  test("rejects deep configuration chaining in an inherited config", async () => {
    const workspace = await createWorkspace({
      fixture: "minimal",
      files: {
        "shared.toml": `schema_version = 1
project_name = "demo"
source_root = "."
output_dir = "dist/demo-bundle"

[repomix]
style = "xml"

[sections.src]
include = ["src/**"]
exclude = []
`,
        "cx.toml": `extends = "shared.toml"
schema_version = 1
project_name = "demo"
source_root = "."
output_dir = "dist/demo-bundle"

[repomix]
style = "xml"

[sections.src]
include = ["src/**"]
exclude = []
`,
        "cx-mcp.toml": `extends = "cx.toml"

[sections.src]
exclude = ["src/tmp/**"]
`,
      },
    });

    await expect(
      loadCxConfig(path.join(workspace.rootDir, "cx-mcp.toml")),
    ).rejects.toThrow(
      "Deep configuration chaining is forbidden. Base configs must not declare extends.",
    );
  });
});
