import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  resolveMcpConfigPath,
  runMcpCommand,
} from "../../src/cli/commands/mcp.js";

describe("mcp registration lane", () => {
  test("prefers cx-mcp.toml over cx.toml", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-mcp-"));
    const basePath = path.join(root, "cx.toml");
    const mcpPath = path.join(root, "cx-mcp.toml");

    await fs.writeFile(
      basePath,
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

    await fs.writeFile(
      mcpPath,
      `extends = "cx.toml"

[sections.src]
exclude = ["dist/**"]
`,
      "utf8",
    );

    await expect(resolveMcpConfigPath(root)).resolves.toBe(mcpPath);
  });

  test("falls back to cx.toml when cx-mcp.toml is missing", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-mcp-fallback-"));
    const basePath = path.join(root, "cx.toml");

    await fs.writeFile(
      basePath,
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

    await expect(resolveMcpConfigPath(root)).resolves.toBe(basePath);
  });

  test("fails when neither mcp profile nor baseline config exists", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-mcp-missing-"));
    await expect(resolveMcpConfigPath(root)).rejects.toThrow(
      `Unable to start cx mcp. Expected cx-mcp.toml or cx.toml in ${path.resolve(root)}.`,
    );
  });

  test("loads the selected profile before starting the MCP server", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-mcp-run-"));
    const basePath = path.join(root, "cx.toml");

    await fs.writeFile(
      basePath,
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

    let loadedPath = "";
    let started = false;
    let startedConfigProjectName = "";

    await expect(
      runMcpCommand(
        { cwd: root },
        {
          loadConfig: async (configPath) => {
            loadedPath = configPath;
            return {
              schemaVersion: 1,
              projectName: "demo",
              sourceRoot: path.join(root),
              outputDir: path.join(root, "dist", "demo-bundle"),
              output: {
                extensions: {
                  xml: ".xml.txt",
                  json: ".json.txt",
                  markdown: ".md",
                  plain: ".txt",
                },
              },
              repomix: {
                style: "xml",
                showLineNumbers: false,
                includeEmptyDirectories: false,
                securityCheck: false,
              },
              files: {
                include: [],
                exclude: [],
                followSymlinks: false,
                unmatched: "ignore",
              },
              dedup: {
                mode: "fail",
                order: "config",
              },
              manifest: {
                format: "json",
                pretty: false,
                includeFileSha256: false,
                includeOutputSha256: false,
                includeOutputSpans: false,
                includeSourceMetadata: false,
              },
              checksums: {
                algorithm: "sha256",
                fileName: "demo.sha256",
              },
              tokens: {
                encoding: "o200k_base",
              },
              assets: {
                include: [],
                exclude: [],
                mode: "copy",
                targetDir: "demo-assets",
                layout: "flat",
              },
              behavior: {
                repomixMissingExtension: "warn",
                configDuplicateEntry: "fail",
              },
              behaviorSources: {
                dedupMode: "compiled default",
                repomixMissingExtension: "compiled default",
                configDuplicateEntry: "compiled default",
                assetsLayout: "compiled default",
              },
              mcp: {
                policy: "default",
                auditLogging: true,
              },
              sections: {
                src: {
                  include: ["src/**"],
                  exclude: [],
                },
              },
            };
          },
          startServer: async (configPath, config) => {
            started = true;
            expect(configPath).toBe(basePath);
            startedConfigProjectName = config.projectName;
          },
          fileExists: async (filePath) => filePath === basePath,
        },
      ),
    ).resolves.toBe(0);

    expect(loadedPath).toBe(basePath);
    expect(started).toBe(true);
    expect(startedConfigProjectName).toBe("demo");
  });
});
