import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { mergeConfigs, packStructured } from "@wstein/repomix";
import { loadManifestFromBundle } from "../../src/bundle/validate.js";
import { runBundleCommand } from "../../src/cli/commands/bundle.js";
import {
  getAdapterModulePath,
  setAdapterPath,
} from "../../src/repomix/capabilities.js";
import {
  getRepomixCapabilities,
  REPOMIX_ADAPTER_CONTRACT,
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

  test("bundling falls back to pack() when structured rendering is unavailable", async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-repomix-fallback-"),
    );
    const adapterDir = path.join(root, "mock-adapter");
    const sourceRoot = path.join(root, "project");
    const bundleDir = path.join(sourceRoot, "dist", "demo-bundle");
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
target_dir = "{project}-assets"

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
      expect(
        await runBundleCommand({ config: path.join(sourceRoot, "cx.toml") }),
      ).toBe(0);

      const capabilities = await getRepomixCapabilities();
      expect(capabilities.contractValid).toBe(true);
      expect(capabilities.capabilities.supportsPackStructured).toBe(false);
      expect(capabilities.spanCapability).toBe("unsupported");
      expect(warnings).toContain("Continuing without span metadata");

      const { manifest } = await loadManifestFromBundle(bundleDir);
      const file = manifest.sections[0]?.files[0];
      expect(file?.outputStartLine).toBeNull();
      expect(file?.outputEndLine).toBeNull();
      expect(file?.tokenCount).toBeGreaterThan(0);
    } finally {
      process.stderr.write = stderrWrite;
      setAdapterPath(previousAdapterPath);
    }
  });
});
