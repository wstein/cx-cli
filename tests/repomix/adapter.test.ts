import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { mergeConfigs, packStructured } from "@wsmy/repomix-cx-fork";
import { runBundleCommand } from "../../src/cli/commands/bundle.js";
import { loadCxConfig } from "../../src/config/load.js";
import {
  getAdapterModulePath,
  setAdapterPath,
} from "../../src/repomix/capabilities.js";
import {
  getRepomixCapabilities,
  REPOMIX_ADAPTER_CONTRACT,
  renderSectionWithRepomix,
} from "../../src/repomix/render.js";

describe("Repomix adapter contract", () => {
  test("exports the public mergeConfigs and packStructured functions", () => {
    expect(typeof mergeConfigs).toBe("function");
    expect(typeof packStructured).toBe("function");
  });

  test("packStructured can be invoked with the same public call shape used by cx", async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-repomix-adapter-"),
    );
    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.writeFile(
      path.join(root, "src", "index.ts"),
      "export const ok = 1;\n",
      "utf8",
    );

    const outputPath = path.join(root, "repomix-output.xml.txt");
    const cliConfig: Parameters<typeof mergeConfigs>[2] = {
      output: {
        filePath: outputPath,
        style: "xml",
        parsableStyle: true,
        fileSummary: true,
        directoryStructure: true,
        files: true,
        removeComments: false,
        removeEmptyLines: false,
        compress: false,
        showLineNumbers: false,
        copyToClipboard: false,
        includeEmptyDirectories: false,
        includeFullDirectoryStructure: false,
        git: {
          includeDiffs: false,
          includeLogs: false,
          includeLogsCount: 50,
          sortByChanges: false,
          sortByChangesMaxCommits: 100,
        },
        topFilesLength: 5,
        truncateBase64: true,
        tokenCountTree: false,
      },
      include: [],
      ignore: {
        useGitignore: false,
        useDotIgnore: false,
        useDefaultPatterns: false,
        customPatterns: [],
      },
      security: {
        enableSecurityCheck: false,
      },
    };

    const merged = mergeConfigs(root, {}, cliConfig);
    const plan = await packStructured([root], merged, {
      explicitFiles: ["src/index.ts"],
    });
    const rendered = await plan.renderWithMap("xml");
    await fs.writeFile(outputPath, rendered.output, "utf8");

    expect((await getRepomixCapabilities()).adapterContract).toBe(
      REPOMIX_ADAPTER_CONTRACT,
    );
    expect(await fs.stat(outputPath)).toBeDefined();
  });

  test("renderSectionWithRepomix returns an empty render for zero files", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-repomix-empty-"));
    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.writeFile(
      path.join(root, "cx.toml"),
      `schema_version = 1
project_name = "demo"
source_root = "."
output_dir = "dist/demo-bundle"

[repomix]
style = "xml"
show_line_numbers = false
include_empty_directories = false
security_check = false

[files]
exclude = ["dist/**"]
follow_symlinks = false
unmatched = "ignore"

[sections.src]
include = ["src/**"]
exclude = []
`,
      "utf8",
    );

    const config = await loadCxConfig(path.join(root, "cx.toml"));
    const outputPath = path.join(root, "empty-output.xml.txt");
    const result = await renderSectionWithRepomix({
      config,
      style: "xml",
      sourceRoot: root,
      outputPath,
      sectionName: "src",
      explicitFiles: [],
    });

    expect(result.outputText).toBe("");
    expect(result.outputTokenCount).toBe(0);
    expect(result.fileTokenCounts.size).toBe(0);
    expect(result.fileContentHashes.size).toBe(0);
    expect(await fs.readFile(outputPath, "utf8")).toBe("");
  });

  test("bundling requires structured rendering for normalized content hashes", async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-repomix-fallback-"),
    );
    const adapterDir = path.join(root, "mock-adapter");
    const sourceRoot = path.join(root, "project");
    await fs.mkdir(adapterDir, { recursive: true });
    await fs.mkdir(path.join(sourceRoot, "src"), { recursive: true });
    await fs.writeFile(
      path.join(sourceRoot, "src", "index.ts"),
      'export const greeting = "hello";\n',
      "utf8",
    );
    await fs.writeFile(
      path.join(sourceRoot, "cx.toml"),
      `schema_version = 1
project_name = "demo"
source_root = "."
output_dir = "dist/demo-bundle"

[repomix]
style = "xml"
show_line_numbers = false
include_empty_directories = false
security_check = false

[manifest]
format = "json"
pretty = true
include_file_sha256 = true
include_output_sha256 = true
include_output_spans = true
include_source_metadata = true

[files]
exclude = ["dist/**"]
follow_symlinks = false
unmatched = "ignore"

[tokens]
encoding = "o200k_base"

[assets]
include = []
exclude = []
mode = "ignore"
target_dir = "assets"

[sections.src]
include = ["src/**"]
exclude = []
`,
      "utf8",
    );
    await fs.writeFile(
      path.join(adapterDir, "package.json"),
      JSON.stringify({
        name: "mock-repomix-pack-only",
        type: "module",
        exports: "./index.js",
      }),
      "utf8",
    );
    await fs.writeFile(
      path.join(adapterDir, "index.js"),
      `import fs from "node:fs/promises";
import path from "node:path";

export function mergeConfigs(rootDir, _fileConfig, cliConfig) {
  return {
    cwd: rootDir,
    ...cliConfig,
    output: { ...cliConfig.output },
    tokenCount: { ...(cliConfig.tokenCount ?? {}) },
  };
}

export async function pack(rootDirs, config, _progress, _options, explicitFiles) {
  const rootDir = rootDirs[0];
  const files = [];
  for (const filePath of explicitFiles) {
    const content = await fs.readFile(filePath, "utf8");
    const relativePath = path.relative(rootDir, filePath).replaceAll("\\\\", "/");
    files.push(\`<file path="\${relativePath}">\\n\${content}</file>\`);
  }
  const output = \`<files>\\n\${files.join("\\n")}\\n</files>\\n\`;
  await fs.writeFile(config.output.filePath, output, "utf8");
}
`,
      "utf8",
    );

    const previousAdapterPath = getAdapterModulePath();
    const stderrWrite = process.stderr.write;
    let warnings = "";
    process.stderr.write = ((chunk: string | Uint8Array) => {
      warnings += String(chunk);
      return true;
    }) as typeof process.stderr.write;
    setAdapterPath(adapterDir);

    try {
      await expect(
        runBundleCommand({ config: path.join(sourceRoot, "cx.toml") }),
      ).rejects.toThrow(
        "packStructured() is required for normalized content hashing",
      );

      const capabilities = await getRepomixCapabilities();
      expect(capabilities.contractValid).toBe(true);
      expect(capabilities.capabilities.supportsPackStructured).toBe(false);
      expect(capabilities.spanCapability).toBe("unsupported");
      expect(warnings).toContain("missing the cx extension");
    } finally {
      process.stderr.write = stderrWrite;
      setAdapterPath(previousAdapterPath);
    }
  });

  test("renderSectionWithRepomix falls back to pack when structured rendering is unavailable", async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-repomix-pack-fallback-"),
    );
    const adapterDir = path.join(root, "mock-adapter");
    await fs.mkdir(adapterDir, { recursive: true });
    await fs.mkdir(path.join(root, "project", "src"), { recursive: true });
    await fs.writeFile(
      path.join(root, "project", "src", "index.ts"),
      "export const ok = 1;\n",
      "utf8",
    );
    await fs.writeFile(
      path.join(root, "project", "cx.toml"),
      `schema_version = 1
project_name = "demo"
source_root = "."
output_dir = "dist/demo-bundle"

[repomix]
style = "xml"
show_line_numbers = false
include_empty_directories = false
security_check = false

[manifest]
format = "json"
pretty = true
include_file_sha256 = true
include_output_sha256 = true
include_output_spans = false
include_source_metadata = true

[files]
exclude = ["dist/**"]
follow_symlinks = false
unmatched = "ignore"

[tokens]
encoding = "o200k_base"

[assets]
include = []
exclude = []
mode = "ignore"
target_dir = "assets"

[sections.src]
include = ["src/**"]
exclude = []
`,
      "utf8",
    );
    await fs.writeFile(
      path.join(adapterDir, "package.json"),
      JSON.stringify({
        name: "mock-repomix-pack-only",
        type: "module",
        exports: "./index.js",
      }),
      "utf8",
    );
    await fs.writeFile(
      path.join(adapterDir, "index.js"),
      `import fs from "node:fs/promises";
import path from "node:path";

export function mergeConfigs(rootDir, _fileConfig, cliConfig) {
  return {
    cwd: rootDir,
    ...cliConfig,
    output: { ...cliConfig.output },
    tokenCount: { ...(cliConfig.tokenCount ?? {}) },
  };
}

export async function pack(rootDirs, config, _progress, _options, explicitFiles) {
  const rootDir = rootDirs[0];
  const lines = [];
  for (const filePath of explicitFiles) {
    const content = await fs.readFile(filePath, "utf8");
    const relativePath = path.relative(rootDir, filePath).replaceAll("\\\\", "/");
    lines.push(\`<file path="\${relativePath}">\\n\${content}</file>\`);
  }
  const output = \`<files>\\n\${lines.join("\\n")}\\n</files>\\n\`;
  await fs.writeFile(config.output.filePath, output, "utf8");
}
`,
      "utf8",
    );

    const previousAdapterPath = getAdapterModulePath();
    setAdapterPath(adapterDir);

    try {
      const config = await loadCxConfig(path.join(root, "project", "cx.toml"));
      const outputPath = path.join(root, "project", "render.xml");
      const result = await renderSectionWithRepomix({
        config,
        style: "xml",
        sourceRoot: path.join(root, "project"),
        outputPath,
        sectionName: "src",
        explicitFiles: [path.join(root, "project", "src", "index.ts")],
      });

      expect(result.outputText).toContain('<file path="src/index.ts">');
      expect(result.outputTokenCount).toBeGreaterThan(0);
      expect(result.fileTokenCounts.get("src/index.ts")).toBeGreaterThan(0);
      expect(await fs.readFile(outputPath, "utf8")).toContain(
        "export const ok = 1;",
      );
    } finally {
      setAdapterPath(previousAdapterPath);
    }
  });
});
