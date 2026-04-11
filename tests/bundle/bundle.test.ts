import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { loadManifestFromBundle } from "../../src/bundle/validate.js";
import { renderManifestToon } from "../../src/manifest/toon.js";
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
    expect(
      await fs.stat(path.join(project.bundleDir, "demo-manifest.toon")),
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
format = "toon"
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
    const docsSectionFiles = manifest.files
      .filter((row) => row.section === "docs")
      .sort(
        (left, right) =>
          (left.outputStartLine as number) - (right.outputStartLine as number),
      );
    const docsOutputPath = path.join(
      project.bundleDir,
      docsSectionFiles[0]?.outputFile as string,
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
          `\n[manifest]\nformat = "toon"\ninclude_file_sha256 = true\ninclude_output_sha256 = true\ninclude_output_spans = true\ninclude_source_metadata = true\n`,
        ),
      "utf8",
    );

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);

    const { manifest } = await loadManifestFromBundle(project.bundleDir);
    const textRows = manifest.files.filter((row) => row.kind === "text");
    const outputByFile = new Map<string, string>();
    for (const row of textRows) {
      if (typeof row.outputFile !== "string") {
        continue;
      }
      if (outputByFile.has(row.outputFile)) {
        continue;
      }
      outputByFile.set(
        row.outputFile,
        await fs.readFile(path.join(project.bundleDir, row.outputFile), "utf8"),
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
      expect(row.outputStartLine).not.toBe("-");
      expect(row.outputEndLine).not.toBe("-");
      if (expectedLineCount === undefined) {
        throw new Error(`Missing expected line count for ${row.path}`);
      }
      expect(
        (row.outputEndLine as number) - (row.outputStartLine as number) + 1,
      ).toBe(expectedLineCount);
      const output = outputByFile.get(row.outputFile as string);
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

  test("groups table files by output_file in Toon manifest", () => {
    const manifest = {
      schemaVersion: 1,
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
        removeComments: false,
        removeEmptyLines: false,
        compress: false,
        showLineNumbers: false,
        includeEmptyDirectories: false,
        securityCheck: false,
        losslessTextExtraction: true,
      },
      sections: [],
      assets: [],
      files: [
        {
          path: "docs/a.md",
          kind: "text",
          section: "docs",
          storedIn: "packed",
          sha256: "sha1",
          sizeBytes: 1,
          mediaType: "text/markdown",
          outputFile: "myproject-repomix-docs.xml.txt",
          outputStartLine: 5,
          outputEndLine: 5,
          exactContentBase64: "-",
        },
        {
          path: "docs/b.md",
          kind: "text",
          section: "docs",
          storedIn: "packed",
          sha256: "sha2",
          sizeBytes: 1,
          mediaType: "text/markdown",
          outputFile: "myproject-repomix-docs.xml.txt",
          outputStartLine: 6,
          outputEndLine: 6,
          exactContentBase64: "-",
        },
        {
          path: "src/c.ts",
          kind: "text",
          section: "src",
          storedIn: "packed",
          sha256: "sha3",
          sizeBytes: 1,
          mediaType: "text/typescript",
          outputFile: "myproject-repomix-src.xml.txt",
          outputStartLine: 10,
          outputEndLine: 10,
          exactContentBase64: "-",
        },
      ],
    } as const;

    const rendered = renderManifestToon(manifest as any);
    expect(rendered).toContain("output_file myproject-repomix-docs.xml.txt");
    expect(rendered).toContain("output_file myproject-repomix-src.xml.txt");
    expect(
      rendered.indexOf("output_file myproject-repomix-docs.xml.txt"),
    ).toBeLessThan(
      rendered.indexOf("output_file myproject-repomix-src.xml.txt"),
    );
    expect(rendered.indexOf("docs/a.md")).toBeLessThan(
      rendered.indexOf("docs/b.md"),
    );
    expect(
      rendered.indexOf("output_file myproject-repomix-docs.xml.txt") <
        rendered.indexOf("docs/a.md"),
    ).toBe(true);
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
    };

    expect(
      await runListCommand({ bundleDir: project.bundleDir, json: true }),
    ).toBe(0);
    process.stdout.write = stdoutWrite;
    const listPayload = JSON.parse(writes.pop() ?? "{}") as {
      summary?: { fileCount?: number; textFileCount?: number };
      repomix?: { spanCapability?: string };
      sections?: Array<{ name: string }>;
    };

    expect(inspectPayload.summary?.sectionCount).toBe(2);
    expect(inspectPayload.summary?.assetCount).toBe(1);
    expect(listPayload.summary?.fileCount).toBe(4);
    expect(listPayload.summary?.textFileCount).toBe(3);
    expect(listPayload.repomix?.spanCapability).toBe("supported");
    expect(listPayload.sections?.map((section) => section.name)).toEqual([
      "docs",
      "src",
    ]);
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
      files?: Array<{ path: string }>;
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
        .filter((line) => !line.includes("demo-manifest.toon"))
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
    expect(payload.error?.path).toBe("demo-manifest.toon");
    expect(payload.error?.message).toContain(
      "Checksum file is missing an entry for demo-manifest.toon.",
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
    expect(payload.summary?.manifestName).toBe("demo-manifest.toon");
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

  test("rejects text extraction for bundles created with lossy transforms", async () => {
    const project = await createProject();
    const restoreDir = path.join(project.root, "restored-lossy");
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
        files: undefined,
        assetsOnly: false,
        overwrite: false,
        verify: false,
      }),
    ).rejects.toThrow("lossy text transforms");
  });

  test("fails verify when the checksum file omits an expected artifact", async () => {
    const project = await createProject();
    const checksumPath = path.join(project.bundleDir, "demo.sha256");

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    await fs.writeFile(
      checksumPath,
      (await fs.readFile(checksumPath, "utf8"))
        .split("\n")
        .filter((line) => !line.includes("demo-manifest.toon"))
        .join("\n"),
      "utf8",
    );

    await expect(
      runVerifyCommand({ bundleDir: project.bundleDir, json: false }),
    ).rejects.toThrow(
      "Checksum file is missing an entry for demo-manifest.toon.",
    );
  });

  test("rejects bundles with multiple manifest files", async () => {
    const project = await createProject();

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    await fs.copyFile(
      path.join(project.bundleDir, "demo-manifest.toon"),
      path.join(project.bundleDir, "demo-copy-manifest.toon"),
    );

    await expect(loadManifestFromBundle(project.bundleDir)).rejects.toThrow(
      "Bundle must contain exactly one manifest file, found 2.",
    );
  });
});
