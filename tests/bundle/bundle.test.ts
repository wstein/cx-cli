import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { loadManifestFromBundle } from "../../src/bundle/validate.js";
import type { CxManifest } from "../../src/manifest/types.js";
import { parseManifestJson, renderManifestJson } from "../../src/manifest/json.js";
import { runBundleCommand } from "../../src/cli/commands/bundle.js";
import { runExtractCommand } from "../../src/cli/commands/extract.js";
import { runInspectCommand } from "../../src/cli/commands/inspect.js";
import { runListCommand } from "../../src/cli/commands/list.js";
import { runValidateCommand } from "../../src/cli/commands/validate.js";
import { runVerifyCommand } from "../../src/cli/commands/verify.js";
import { sha256File } from "../../src/shared/hashing.js";

function countLogicalLines(content: string): number {
  if (content === "") {
    return 0;
  }

  const lines = content.split("\n");
  return content.endsWith("\n") ? lines.length - 1 : lines.length;
}

function countNewlines(content: string): number {
  let count = 0;
  for (const character of content) {
    if (character === "\n") {
      count += 1;
    }
  }
  return count;
}

function findExpectedContentStartLine(params: {
  output: string;
  style: "xml" | "markdown" | "json" | "plain";
  filePath: string;
}): number {
  const { output, style, filePath } = params;

  if (style === "xml") {
    const marker = `<file path="${filePath}">`;
    const markerOffset = output.indexOf(marker);
    if (markerOffset === -1) {
      throw new Error(`Missing XML marker for ${filePath}`);
    }
    const contentStart = markerOffset + marker.length + 1;
    return countNewlines(output.slice(0, contentStart)) + 1;
  }

  if (style === "markdown") {
    const heading = `## File: ${filePath}\n`;
    const headingOffset = output.indexOf(heading);
    if (headingOffset === -1) {
      throw new Error(`Missing Markdown heading for ${filePath}`);
    }
    const fenceLineEnd = output.indexOf("\n", headingOffset + heading.length);
    if (fenceLineEnd === -1) {
      throw new Error(`Missing Markdown code fence for ${filePath}`);
    }
    const contentStart = fenceLineEnd + 1;
    return countNewlines(output.slice(0, contentStart)) + 1;
  }

  if (style === "plain") {
    const marker = `================\nFile: ${filePath}\n================\n`;
    const markerOffset = output.indexOf(marker);
    if (markerOffset === -1) {
      throw new Error(`Missing plain marker for ${filePath}`);
    }
    const contentStart = markerOffset + marker.length;
    return countNewlines(output.slice(0, contentStart)) + 1;
  }

  const keyMarker = `\n    ${JSON.stringify(filePath)}: `;
  const keyOffset = output.indexOf(keyMarker);
  if (keyOffset === -1) {
    throw new Error(`Missing JSON key for ${filePath}`);
  }
  const contentStart = keyOffset + 1;
  return countNewlines(output.slice(0, contentStart)) + 1;
}

async function createProject(): Promise<{
  root: string;
  configPath: string;
  bundleDir: string;
}> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-bundle-"));
  const bundleDir = path.join(root, "dist", "demo-bundle");
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.mkdir(path.join(root, "docs"), { recursive: true });
  await fs.writeFile(
    path.join(root, "README.md"),
    "# Demo\n\n```\ncode fence\n```\n",
    "utf8",
  );
  await fs.writeFile(
    path.join(root, "src", "index.ts"),
    'export const demo = "================";\n',
    "utf8",
  );
  await fs.writeFile(
    path.join(root, "docs", "guide.md"),
    "hello\n================\nstill content\n",
    "utf8",
  );
  await fs.writeFile(path.join(root, "logo.png"), "fakepng", "utf8");
  const configPath = path.join(root, "cx.toml");
  await fs.writeFile(
    configPath,
    `schema_version = 1
project_name = "demo"
source_root = "."
output_dir = "dist/demo-bundle"

[repomix]
style = "xml"
compress = false
remove_comments = false
remove_empty_lines = false
show_line_numbers = false
include_empty_directories = false
security_check = false

[files]
exclude = ["dist/**"]
follow_symlinks = false
unmatched = "ignore"

[assets]
include = ["**/*.png"]
exclude = []
mode = "copy"
target_dir = "{project}-assets"

[sections.docs]
include = ["README.md", "docs/**"]
exclude = []

[sections.src]
include = ["src/**"]
exclude = []
`,
    "utf8",
  );

  return { root, configPath, bundleDir };
}

describe("bundle workflow", () => {
  test("creates, validates, lists, and verifies a bundle", async () => {
    const project = await createProject();
    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    expect(await runValidateCommand({ bundleDir: project.bundleDir })).toBe(0);
    expect(await runVerifyCommand({ bundleDir: project.bundleDir })).toBe(0);

    const writes: string[] = [];
    const stdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    expect(
      await runListCommand({ bundleDir: project.bundleDir, json: false }),
    ).toBe(0);
    process.stdout.write = stdoutWrite;

    expect(writes.join("")).toContain("README.md");
    expect(writes.join("")).toContain("docs");
    expect(writes.join("")).toContain("status");
    expect(writes.join("")).not.toContain("kind\tsection\tstored_in");
    expect(
      await fs.stat(path.join(project.bundleDir, "demo-manifest.json")),
    ).toBeDefined();
    expect(
      await fs.stat(path.join(project.bundleDir, "demo.sha256")),
    ).toBeDefined();
  });

  test("emits absolute output spans from renderWithMap for all files", async () => {
    const project = await createProject();
    // Add manifest section with span capture enabled
    const configContents = await fs.readFile(project.configPath, "utf8");
    const manifestSection = `\n[manifest]
format = "json"
include_file_sha256 = true
include_output_sha256 = true
include_output_spans = true
include_source_metadata = true`;
    await fs.writeFile(
      project.configPath,
      configContents + manifestSection,
      "utf8",
    );

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);

    // Spans are based on bare file content, not wrapper markup.
    const { manifest } = await loadManifestFromBundle(project.bundleDir);
    const docsSection = manifest.sections.find((s) => s.name === "docs");
    const docsSectionFiles = (docsSection?.files ?? []).sort(
      (left, right) =>
        (left.outputStartLine as number) - (right.outputStartLine as number),
    );
    const docsOutputPath = path.join(
      project.bundleDir,
      docsSection?.outputFile ?? "",
    );
    const docsOutput = await fs.readFile(docsOutputPath, "utf8");
    const expectedLengths = [
      [
        "docs/guide.md",
        countLogicalLines(
          await fs.readFile(path.join(project.root, "docs/guide.md"), "utf8"),
        ),
      ],
      [
        "README.md",
        countLogicalLines(
          await fs.readFile(path.join(project.root, "README.md"), "utf8"),
        ),
      ],
    ] as const;

    expect(docsSectionFiles.map((row) => row.path)).toEqual([
      "docs/guide.md",
      "README.md",
    ]);
    expect(docsSectionFiles[0]?.outputStartLine).toBe(
      findExpectedContentStartLine({
        output: docsOutput,
        style: "xml",
        filePath: "docs/guide.md",
      }),
    );
    expect(docsSectionFiles[0]?.outputEndLine).toBe(
      (docsSectionFiles[0]?.outputStartLine as number) +
        expectedLengths[0][1] -
        1,
    );
    expect(docsSectionFiles[1]?.outputStartLine).toBe(
      findExpectedContentStartLine({
        output: docsOutput,
        style: "xml",
        filePath: "README.md",
      }),
    );
    expect(docsSectionFiles[1]?.outputEndLine).toBe(
      (docsSectionFiles[1]?.outputStartLine as number) +
        expectedLengths[1][1] -
        1,
    );
  });

  test.each([
    "json",
    "markdown",
    "plain",
  ] as const)(
    "emits absolute output spans for %s bundles",
    async (style: "json" | "markdown" | "plain") => {
    const project = await createProject();
    await fs.writeFile(
      path.join(project.root, "README.md"),
      "alpha\nbeta",
      "utf8",
    );
    await fs.writeFile(
      path.join(project.root, "docs", "guide.md"),
      "gamma\n",
      "utf8",
    );
    await fs.writeFile(
      path.join(project.root, "src", "index.ts"),
      "delta\nepsilon",
      "utf8",
    );
    const configContents = await fs.readFile(project.configPath, "utf8");
    await fs.writeFile(
      project.configPath,
      configContents
        .replace('style = "xml"', `style = "${style}"`)
        .concat(
          `\n[manifest]\nformat = "json"\ninclude_file_sha256 = true\ninclude_output_sha256 = true\ninclude_output_spans = true\ninclude_source_metadata = true\n`,
        ),
      "utf8",
    );

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);

    const { manifest } = await loadManifestFromBundle(project.bundleDir);
    const textRows = manifest.files.filter((row) => row.kind === "text");
    const sectionOutputFileMap = new Map(
      manifest.sections.map((s) => [s.name, s.outputFile]),
    );
    const outputByFile = new Map<string, string>();
    for (const row of textRows) {
      const outputFile = sectionOutputFileMap.get(row.section);
      if (outputFile === undefined) continue;
      if (outputByFile.has(outputFile)) continue;
      outputByFile.set(
        outputFile,
        await fs.readFile(path.join(project.bundleDir, outputFile), "utf8"),
      );
    }
    const sortedRows = [...textRows].sort(
      (left, right) =>
        (left.outputStartLine as number) - (right.outputStartLine as number),
    );
    const expectedLineCounts = new Map([
      ["docs/guide.md", 1],
      ["README.md", 2],
      ["src/index.ts", 2],
    ]);

    for (const row of sortedRows) {
      const expectedLineCount = expectedLineCounts.get(row.path);
      expect(expectedLineCount).toBeDefined();
      expect(row.outputStartLine).not.toBeNull();
      expect(row.outputEndLine).not.toBeNull();
      if (expectedLineCount === undefined) {
        throw new Error(`Missing expected line count for ${row.path}`);
      }
      expect(
        (row.outputEndLine as number) - (row.outputStartLine as number) + 1,
      ).toBe(expectedLineCount);
      const outputFile = sectionOutputFileMap.get(row.section);
      const output = outputFile !== undefined ? outputByFile.get(outputFile) : undefined;
      expect(output).toBeDefined();
      expect(row.outputStartLine).toBe(
        findExpectedContentStartLine({
          output: output as string,
          style,
          filePath: row.path,
        }),
      );
    }
    },
  );

  test("nests files inside their section in the JSON manifest", () => {
    const manifest: CxManifest = {
      schemaVersion: 2,
      bundleVersion: 1,
      projectName: "demo",
      sourceRoot: "/tmp",
      bundleDir: "/tmp/out",
      checksumFile: "demo.sha256",
      createdAt: new Date().toISOString(),
      cxVersion: "0.1.0",
      repomixVersion: "1.13.1",
      checksumAlgorithm: "sha256",
      settings: {
        globalStyle: "xml",
        tokenAlgorithm: "chars_div_4",
        removeComments: false,
        removeEmptyLines: false,
        compress: false,
        showLineNumbers: false,
        includeEmptyDirectories: false,
        securityCheck: false,
        listDisplay: {
          bytesWarm: 4096,
          bytesHot: 65536,
          tokensWarm: 512,
          tokensHot: 2048,
          mtimeWarmMinutes: 60,
          mtimeHotHours: 24,
          timePalette: [255, 254, 253, 252, 251, 250, 249, 248, 247, 246],
        },
      },
      sections: [
        {
          name: "docs",
          style: "xml",
          outputFile: "myproject-repomix-docs.xml.txt",
          outputSha256: "aaa",
          fileCount: 2,
          files: [
            { path: "docs/a.md", kind: "text", section: "docs", storedIn: "packed", sha256: "sha1", sizeBytes: 1, mtime: "2026-04-11T00:00:00.000Z", mediaType: "text/markdown", outputStartLine: 5, outputEndLine: 5 },
            { path: "docs/b.md", kind: "text", section: "docs", storedIn: "packed", sha256: "sha2", sizeBytes: 1, mtime: "2026-04-11T00:00:00.000Z", mediaType: "text/markdown", outputStartLine: 6, outputEndLine: 6 },
          ],
        },
        {
          name: "src",
          style: "xml",
          outputFile: "myproject-repomix-src.xml.txt",
          outputSha256: "bbb",
          fileCount: 1,
          files: [
            { path: "src/c.ts", kind: "text", section: "src", storedIn: "packed", sha256: "sha3", sizeBytes: 1, mtime: "2026-04-11T00:00:00.000Z", mediaType: "text/typescript", outputStartLine: 10, outputEndLine: 10 },
          ],
        },
      ],
      assets: [],
      files: [],
    };

    const rendered = renderManifestJson(manifest);
    // docs section appears before src section
    expect(rendered.indexOf("docs")).toBeLessThan(rendered.indexOf("src"));
    // files are nested under their section
    expect(rendered.indexOf("myproject-repomix-docs.xml.txt")).toBeLessThan(
      rendered.indexOf("docs/a.md"),
    );
    expect(rendered.indexOf("docs/a.md")).toBeLessThan(
      rendered.indexOf("docs/b.md"),
    );
    expect(rendered.indexOf("myproject-repomix-src.xml.txt")).toBeLessThan(
      rendered.indexOf("src/c.ts"),
    );
    // round-trip
    const reparsed = parseManifestJson(rendered);
    expect(reparsed.sections).toHaveLength(2);
    expect(reparsed.sections[0]?.files).toHaveLength(2);
    expect(reparsed.sections[1]?.files).toHaveLength(1);
    expect(reparsed.sections[0]?.files[0]?.path).toBe("docs/a.md");
  });

  test("emits structured JSON for list and inspect automation", async () => {
    const project = await createProject();
    const writes: string[] = [];
    const stdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    expect(
      await runInspectCommand({ config: project.configPath, json: true }),
    ).toBe(0);
    const inspectPayload = JSON.parse(writes.pop() ?? "{}") as {
      summary?: { sectionCount?: number; assetCount?: number };
      bundleComparison?: { available?: boolean };
      sections?: Array<{
        name?: string;
        files?: Array<{
          relativePath?: string;
          extractability?: { status?: string } | null;
        }>;
      }>;
    };

    expect(
      await runListCommand({ bundleDir: project.bundleDir, json: true }),
    ).toBe(0);
    process.stdout.write = stdoutWrite;
    const listPayload = JSON.parse(writes.pop() ?? "{}") as {
      summary?: { fileCount?: number; textFileCount?: number };
      repomix?: { spanCapability?: string };
      sections?: Array<{ name: string }>;
      files?: Array<{
        path?: string;
        status?: string;
        mtime?: string;
        extractability?: { status?: string; reason?: string };
      }>;
    };

    expect(inspectPayload.summary?.sectionCount).toBe(2);
    expect(inspectPayload.summary?.assetCount).toBe(1);
    expect(
      inspectPayload.sections
        ?.flatMap((section) => section.files ?? [])
        .find((file) => file.relativePath === "src/index.ts")
        ?.extractability?.status,
    ).toBe("intact");
    expect(listPayload.summary?.fileCount).toBe(4);
    expect(listPayload.summary?.textFileCount).toBe(3);
    expect(listPayload.repomix?.spanCapability).toBe("supported");
    expect(listPayload.sections?.map((section) => section.name)).toEqual([
      "docs",
      "src",
    ]);
    expect(
      listPayload.files?.every(
        (file) =>
          file.extractability?.status === "intact" ||
          file.extractability?.status === "degraded" ||
          file.extractability?.status === "copied",
      ),
    ).toBe(true);
    expect(listPayload.files?.find((file) => file.path === "src/index.ts")?.status).toBe(
      "intact",
    );
    expect(inspectPayload.bundleComparison?.available).toBe(true);
  });

  test("renders human inspect output with bundle status vocabulary", async () => {
    const project = await createProject();
    const writes: string[] = [];
    const stdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    expect(
      await runInspectCommand({ config: project.configPath, json: false }),
    ).toBe(0);

    process.stdout.write = stdoutWrite;
    const output = writes.join("");
    expect(output).toContain("bundle_status: available");
    expect(output).toContain("intact   src/index.ts");
    expect(output).toContain("copied   logo.png");
  });

  test("emits filtered JSON for list and extract automation", async () => {
    const project = await createProject();
    const restoreDir = path.join(project.root, "restored-filtered");
    const writes: string[] = [];
    const stdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    expect(
      await runListCommand({
        bundleDir: project.bundleDir,
        files: ["src/index.ts"],
        json: true,
        sections: ["src"],
      }),
    ).toBe(0);
    const listPayload = JSON.parse(writes.pop() ?? "{}") as {
      summary?: { fileCount?: number; sectionCount?: number };
      selection?: { sections?: string[]; files?: string[] };
      files?: Array<{
        path: string;
        status?: string;
        mtime?: string;
        extractability?: { status?: string; reason?: string };
      }>;
    };

    expect(
      await runExtractCommand({
        bundleDir: project.bundleDir,
        destinationDir: restoreDir,
        sections: ["src"],
        files: undefined,
        assetsOnly: false,
        overwrite: false,
        verify: true,
        json: true,
      }),
    ).toBe(0);
    process.stdout.write = stdoutWrite;

    const extractPayload = JSON.parse(writes.pop() ?? "{}") as {
      summary?: { fileCount?: number; textFileCount?: number };
      extractedSections?: string[];
      extractedFiles?: string[];
      selection?: { sections?: string[] };
    };

    expect(listPayload.summary?.fileCount).toBe(1);
    expect(listPayload.summary?.sectionCount).toBe(1);
    expect(listPayload.selection?.sections).toEqual(["src"]);
    expect(listPayload.selection?.files).toEqual(["src/index.ts"]);
    expect(listPayload.files?.map((file) => file.path)).toEqual([
      "src/index.ts",
    ]);
    expect(listPayload.files?.[0]?.status).toBe("intact");
    expect(listPayload.files?.[0]?.mtime).toBeDefined();
    expect(listPayload.files?.[0]?.extractability?.status).toBe("intact");
    expect(extractPayload.summary?.fileCount).toBe(2);
    expect(extractPayload.summary?.textFileCount).toBe(1);
    expect(extractPayload.extractedSections).toEqual(["src"]);
    expect(extractPayload.extractedFiles?.sort()).toEqual([
      "logo.png",
      "src/index.ts",
    ]);
    expect(extractPayload.selection?.sections).toEqual(["src"]);
  });

  test("emits structured JSON for bundle and verify automation", async () => {
    const project = await createProject();
    const writes: string[] = [];
    const stdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    expect(
      await runBundleCommand({ config: project.configPath, json: true }),
    ).toBe(0);
    const bundlePayload = JSON.parse(writes.pop() ?? "{}") as {
      checksumFile?: string;
      repomix?: {
        adapterContract?: string;
        compatibilityStrategy?: string;
        supportedRepomixVersion?: string;
        packageVersion?: string;
        packageName?: string;
        spanCapability?: string;
        spanCapabilityReason?: string;
      };
    };

    expect(
      await runVerifyCommand({
        bundleDir: project.bundleDir,
        againstDir: project.root,
        files: ["src/index.ts"],
        json: true,
        sections: undefined,
      }),
    ).toBe(0);
    process.stdout.write = stdoutWrite;

    const verifyPayload = JSON.parse(writes.pop() ?? "{}") as {
      valid?: boolean;
      files?: string[];
      repomix?: { spanCapabilityReason?: string };
    };

    expect(bundlePayload.checksumFile).toBe("demo.sha256");
    expect(bundlePayload.repomix?.adapterContract).toBe("repomix-pack-v1");
    expect(bundlePayload.repomix?.compatibilityStrategy).toBe(
      "capability-aware with renderWithMap support",
    );
    expect(bundlePayload.repomix?.packageVersion).toBe("1.13.1-cx.2");
    expect(verifyPayload.valid).toBe(true);
    expect(verifyPayload.files).toEqual(["src/index.ts"]);
    expect(verifyPayload.repomix?.spanCapabilityReason).toContain(
      "renderWithMap",
    );
  });

  test("emits structured JSON failure payload for checksum omission", async () => {
    const project = await createProject();
    const writes: string[] = [];
    const stdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    const checksumPath = path.join(project.bundleDir, "demo.sha256");
    await fs.writeFile(
      checksumPath,
      (await fs.readFile(checksumPath, "utf8"))
        .split("\n")
        .filter((line) => !line.includes("demo-manifest.json"))
        .join("\n"),
      "utf8",
    );

    expect(
      await runVerifyCommand({ bundleDir: project.bundleDir, json: true }),
    ).toBe(10);
    process.stdout.write = stdoutWrite;

    const payload = JSON.parse(writes.pop() ?? "{}") as {
      valid?: boolean;
      error?: { type?: string; message?: string; path?: string };
    };

    expect(payload.valid).toBe(false);
    expect(payload.error?.type).toBe("checksum_omission");
    expect(payload.error?.path).toBe("demo-manifest.json");
    expect(payload.error?.message).toContain(
      "Checksum file is missing an entry for demo-manifest.json.",
    );
  });

  test("emits structured JSON failure payload for source-tree drift", async () => {
    const project = await createProject();
    const writes: string[] = [];
    const stdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    await fs.writeFile(
      path.join(project.root, "README.md"),
      "# Drifted\n",
      "utf8",
    );

    expect(
      await runVerifyCommand({
        bundleDir: project.bundleDir,
        againstDir: project.root,
        json: true,
      }),
    ).toBe(10);
    process.stdout.write = stdoutWrite;

    const payload = JSON.parse(writes.pop() ?? "{}") as {
      valid?: boolean;
      error?: { type?: string; message?: string; path?: string };
    };

    expect(payload.valid).toBe(false);
    expect(payload.error?.type).toBe("source_tree_drift");
    expect(payload.error?.path).toBe("README.md");
    expect(payload.error?.message).toContain(
      "Source tree mismatch for README.md",
    );
  });

  test("emits detailed JSON for validate automation", async () => {
    const project = await createProject();
    const writes: string[] = [];
    const stdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    expect(
      await runValidateCommand({ bundleDir: project.bundleDir, json: true }),
    ).toBe(0);
    process.stdout.write = stdoutWrite;

    const payload = JSON.parse(writes.pop() ?? "{}") as {
      valid?: boolean;
      checksumFile?: string;
      summary?: {
        manifestName?: string;
        sectionCount?: number;
        fileCount?: number;
      };
    };

    expect(payload.valid).toBe(true);
    expect(payload.checksumFile).toBe("demo.sha256");
    expect(payload.summary?.manifestName).toBe("demo-manifest.json");
    expect(payload.summary?.sectionCount).toBe(2);
    expect(payload.summary?.fileCount).toBe(4);
  });

  test("round-trips extracted files exactly for xml bundles", async () => {
    const project = await createProject();
    const restoreDir = path.join(project.root, "restored");

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    expect(
      await runExtractCommand({
        bundleDir: project.bundleDir,
        destinationDir: restoreDir,
        sections: undefined,
        files: undefined,
        assetsOnly: false,
        overwrite: false,
        verify: true,
      }),
    ).toBe(0);

    for (const relativePath of [
      "README.md",
      "docs/guide.md",
      "src/index.ts",
      "logo.png",
    ]) {
      expect(await sha256File(path.join(restoreDir, relativePath))).toBe(
        await sha256File(path.join(project.root, relativePath)),
      );
    }
  });

  test("round-trips extracted files exactly for json bundles", async () => {
    const project = await createProject();
    const restoreDir = path.join(project.root, "restored-json");
    await fs.writeFile(
      project.configPath,
      (await fs.readFile(project.configPath, "utf8")).replace(
        'style = "xml"',
        'style = "json"',
      ),
      "utf8",
    );

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    expect(
      await runExtractCommand({
        bundleDir: project.bundleDir,
        destinationDir: restoreDir,
        sections: undefined,
        files: undefined,
        assetsOnly: false,
        overwrite: false,
        verify: true,
      }),
    ).toBe(0);

    for (const relativePath of [
      "README.md",
      "docs/guide.md",
      "src/index.ts",
      "logo.png",
    ]) {
      expect(await sha256File(path.join(restoreDir, relativePath))).toBe(
        await sha256File(path.join(project.root, relativePath)),
      );
    }
  });

  test("round-trips extracted files exactly for markdown bundles", async () => {
    const project = await createProject();
    const restoreDir = path.join(project.root, "restored-markdown");
    await fs.writeFile(
      project.configPath,
      (await fs.readFile(project.configPath, "utf8")).replace(
        'style = "xml"',
        'style = "markdown"',
      ),
      "utf8",
    );

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    expect(
      await runExtractCommand({
        bundleDir: project.bundleDir,
        destinationDir: restoreDir,
        sections: undefined,
        files: undefined,
        assetsOnly: false,
        overwrite: false,
        verify: true,
      }),
    ).toBe(0);

    for (const relativePath of [
      "README.md",
      "docs/guide.md",
      "src/index.ts",
      "logo.png",
    ]) {
      expect(await sha256File(path.join(restoreDir, relativePath))).toBe(
        await sha256File(path.join(project.root, relativePath)),
      );
    }
  });

  test("round-trips extracted files exactly for plain bundles", async () => {
    const project = await createProject();
    const restoreDir = path.join(project.root, "restored-plain");
    await fs.writeFile(
      project.configPath,
      (await fs.readFile(project.configPath, "utf8")).replace(
        'style = "xml"',
        'style = "plain"',
      ),
      "utf8",
    );

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    expect(
      await runExtractCommand({
        bundleDir: project.bundleDir,
        destinationDir: restoreDir,
        sections: undefined,
        files: undefined,
        assetsOnly: false,
        overwrite: false,
        verify: true,
      }),
    ).toBe(0);

    for (const relativePath of [
      "README.md",
      "docs/guide.md",
      "src/index.ts",
      "logo.png",
    ]) {
      expect(await sha256File(path.join(restoreDir, relativePath))).toBe(
        await sha256File(path.join(project.root, relativePath)),
      );
    }
  });

  test("verifies a bundle against the original source tree", async () => {
    const project = await createProject();

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    expect(
      await runVerifyCommand({
        bundleDir: project.bundleDir,
        againstDir: project.root,
        files: undefined,
        json: false,
        sections: undefined,
      }),
    ).toBe(0);
  });

  test("fails verify --against when the source tree drifts", async () => {
    const project = await createProject();

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    await fs.writeFile(
      path.join(project.root, "README.md"),
      "# Drifted\n",
      "utf8",
    );

    await expect(
      runVerifyCommand({
        bundleDir: project.bundleDir,
        againstDir: project.root,
        files: undefined,
        json: false,
        sections: undefined,
      }),
    ).rejects.toThrow("Source tree mismatch");
  });

  test("supports selective verify --against by file", async () => {
    const project = await createProject();

    expect(
      await runBundleCommand({ config: project.configPath, json: false }),
    ).toBe(0);
    await fs.writeFile(
      path.join(project.root, "README.md"),
      "# Drifted\n",
      "utf8",
    );

    expect(
      await runVerifyCommand({
        bundleDir: project.bundleDir,
        againstDir: project.root,
        files: ["src/index.ts"],
        json: false,
        sections: undefined,
      }),
    ).toBe(0);

    await expect(
      runVerifyCommand({
        bundleDir: project.bundleDir,
        againstDir: project.root,
        files: ["README.md"],
        json: false,
        sections: undefined,
      }),
    ).rejects.toThrow("Source tree mismatch");
  });

  test("supports selective verify --against by section", async () => {
    const project = await createProject();

    expect(
      await runBundleCommand({ config: project.configPath, json: false }),
    ).toBe(0);
    await fs.writeFile(
      path.join(project.root, "README.md"),
      "# Drifted\n",
      "utf8",
    );

    expect(
      await runVerifyCommand({
        bundleDir: project.bundleDir,
        againstDir: project.root,
        files: undefined,
        json: false,
        sections: ["src"],
      }),
    ).toBe(0);

    await expect(
      runVerifyCommand({
        bundleDir: project.bundleDir,
        againstDir: project.root,
        files: undefined,
        json: false,
        sections: ["docs"],
      }),
    ).rejects.toThrow("Source tree mismatch");
  });

  test("blocks degraded extraction unless explicitly allowed", async () => {
    const project = await createProject();
    const restoreDir = path.join(project.root, "restored-lossy");
    await fs.writeFile(
      project.configPath,
      (await fs.readFile(project.configPath, "utf8")).replace(
        "show_line_numbers = false",
        "show_line_numbers = true",
      ),
      "utf8",
    );

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    await expect(
      runExtractCommand({
        bundleDir: project.bundleDir,
        destinationDir: restoreDir,
        sections: undefined,
        files: ["src/index.ts"],
        assetsOnly: false,
        overwrite: false,
        verify: false,
      }),
    ).rejects.toThrow(
      "File src/index.ts is degraded and requires --allow-degraded to extract.",
    );
  });

  test("emits structured JSON failure payload for extract mismatches", async () => {
    const project = await createProject();
    const restoreDir = path.join(project.root, "restored-lossy-json");
    const writes: string[] = [];
    const stdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    await fs.writeFile(
      project.configPath,
      (await fs.readFile(project.configPath, "utf8")).replace(
        "show_line_numbers = false",
        "show_line_numbers = true",
      ),
      "utf8",
    );

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    expect(
      await runExtractCommand({
        bundleDir: project.bundleDir,
        destinationDir: restoreDir,
        sections: undefined,
        files: ["src/index.ts"],
        assetsOnly: false,
        overwrite: false,
        verify: false,
        json: true,
      }),
    ).toBe(8);

    process.stdout.write = stdoutWrite;
    const payload = JSON.parse(writes.pop() ?? "{}") as {
      valid?: boolean;
      error?: {
        type?: string;
        files?: Array<{
          path?: string;
          reason?: string;
          expectedSha256?: string;
          actualSha256?: string;
        }>;
      };
    };

    expect(payload.valid).toBe(false);
    expect(payload.error?.type).toBe("extractability_mismatch");
    expect(payload.error?.files?.[0]?.path).toBe("src/index.ts");
    expect(payload.error?.files?.[0]?.reason).toBe("manifest_hash_mismatch");
    expect(payload.error?.files?.[0]?.expectedSha256).toBeDefined();
    expect(payload.error?.files?.[0]?.actualSha256).toBeDefined();
  });

  test("surfaces blocked extractability in list JSON before extraction", async () => {
    const project = await createProject();
    const writes: string[] = [];
    const stdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    await fs.writeFile(
      project.configPath,
      (await fs.readFile(project.configPath, "utf8")).replace(
        "show_line_numbers = false",
        "show_line_numbers = true",
      ),
      "utf8",
    );

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    expect(
      await runListCommand({
        bundleDir: project.bundleDir,
        files: ["src/index.ts"],
        json: true,
      }),
    ).toBe(0);

    process.stdout.write = stdoutWrite;
    const payload = JSON.parse(writes.pop() ?? "{}") as {
      files?: Array<{
        path?: string;
        status?: string;
        extractability?: { status?: string; reason?: string };
      }>;
    };

    expect(payload.files?.[0]?.path).toBe("src/index.ts");
    expect(payload.files?.[0]?.status).toBe("degraded");
    expect(payload.files?.[0]?.extractability?.status).toBe("degraded");
    expect(payload.files?.[0]?.extractability?.reason).toBe(
      "manifest_hash_mismatch",
    );
  });

  test("extracts individually lossless files from bundles marked lossy", async () => {
    const project = await createProject();
    const restoreDir = path.join(project.root, "restored-lossy-single");
    await fs.writeFile(
      project.configPath,
      (await fs.readFile(project.configPath, "utf8")).replace(
        "remove_empty_lines = false",
        "remove_empty_lines = true",
      ),
      "utf8",
    );

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    await expect(
      runExtractCommand({
        bundleDir: project.bundleDir,
        destinationDir: restoreDir,
        sections: undefined,
        files: ["src/index.ts"],
        assetsOnly: false,
        overwrite: false,
        verify: true,
      }),
    ).resolves.toBe(0);

    expect(
      await fs.readFile(path.join(restoreDir, "src", "index.ts"), "utf8"),
    ).toBe(await fs.readFile(path.join(project.root, "src", "index.ts"), "utf8"));
    const restoredStat = await fs.stat(path.join(restoreDir, "src", "index.ts"));
    const sourceStat = await fs.stat(path.join(project.root, "src", "index.ts"));
    expect(restoredStat.mtime.toISOString()).toBe(sourceStat.mtime.toISOString());
  });

  test("extracts degraded files with explicit opt-in", async () => {
    const project = await createProject();
    const restoreDir = path.join(project.root, "restored-degraded");
    await fs.writeFile(
      project.configPath,
      (await fs.readFile(project.configPath, "utf8")).replace(
        "show_line_numbers = false",
        "show_line_numbers = true",
      ),
      "utf8",
    );

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    await expect(
      runExtractCommand({
        bundleDir: project.bundleDir,
        destinationDir: restoreDir,
        sections: undefined,
        files: ["src/index.ts"],
        assetsOnly: false,
        allowDegraded: true,
        overwrite: false,
        verify: false,
      }),
    ).resolves.toBe(0);

    expect(
      await fs.readFile(path.join(restoreDir, "src", "index.ts"), "utf8"),
    ).not.toBe(await fs.readFile(path.join(project.root, "src", "index.ts"), "utf8"));
  });

  test("fails verify when the checksum file omits an expected artifact", async () => {
    const project = await createProject();
    const checksumPath = path.join(project.bundleDir, "demo.sha256");

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    await fs.writeFile(
      checksumPath,
      (await fs.readFile(checksumPath, "utf8"))
        .split("\n")
        .filter((line) => !line.includes("demo-manifest.json"))
        .join("\n"),
      "utf8",
    );

    await expect(
      runVerifyCommand({ bundleDir: project.bundleDir, json: false }),
    ).rejects.toThrow(
      "Checksum file is missing an entry for demo-manifest.json.",
    );
  });

  test("rejects bundles with multiple manifest files", async () => {
    const project = await createProject();

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    await fs.copyFile(
      path.join(project.bundleDir, "demo-manifest.json"),
      path.join(project.bundleDir, "demo-copy-manifest.json"),
    );

    await expect(loadManifestFromBundle(project.bundleDir)).rejects.toThrow(
      "Bundle must contain exactly one manifest file, found 2.",
    );
  });
});
