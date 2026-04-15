import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { loadManifestFromBundle } from "../../src/bundle/validate.js";
import { runBundleCommand } from "../../src/cli/commands/bundle.js";
import { runExtractCommand } from "../../src/cli/commands/extract.js";
import { runInspectCommand } from "../../src/cli/commands/inspect.js";
import { runListCommand } from "../../src/cli/commands/list.js";
import { runValidateCommand } from "../../src/cli/commands/validate.js";
import { runVerifyCommand } from "../../src/cli/commands/verify.js";
import {
  MANIFEST_SCHEMA_VERSION,
  parseManifestJson,
  renderManifestJson,
} from "../../src/manifest/json.js";
import type { CxManifest } from "../../src/manifest/types.js";
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

async function expectExtractedFilesToMatchManifest(params: {
  bundleDir: string;
  restoreDir: string;
}): Promise<void> {
  const { manifest } = await loadManifestFromBundle(params.bundleDir);
  for (const row of manifest.files) {
    const extractedPath = path.join(params.restoreDir, row.path);
    expect(await sha256File(extractedPath)).toBe(row.sha256);
  }
}

async function createProject(options?: {
  includeSpecialChecksumFile?: boolean;
  includeLinkedNotes?: boolean;
}): Promise<{
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
  if (options?.includeLinkedNotes) {
    await fs.writeFile(
      path.join(root, "src", "index.ts"),
      '// [[Linked Note]]\nexport const demo = "================";\n',
      "utf8",
    );
    await fs.mkdir(path.join(root, "notes"), { recursive: true });
    await fs.writeFile(
      path.join(root, "notes", "linked-note.md"),
      `---
id: 20260414120000
title: Linked Note
aliases: []
tags: []
---

This note is linked from source code.

## Links

- [[README.md]]
`,
      "utf8",
    );
  }
  await fs.writeFile(
    path.join(root, "docs", "guide.md"),
    "hello\n================\nstill content\n",
    "utf8",
  );
  if (options?.includeSpecialChecksumFile) {
    await fs.mkdir(path.join(root, "src", "special cases"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(root, "src", "special cases", "checksum + edge.ts"),
      "export const special = true;\n",
      "utf8",
    );
  }
  await fs.writeFile(path.join(root, "logo.png"), "fakepng", "utf8");
  const configPath = path.join(root, "cx.toml");
  const linkedNotesConfig = options?.includeLinkedNotes
    ? "\ninclude_linked_notes = true"
    : "";
  await fs.writeFile(
    configPath,
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

[assets]
include = ["**/*.png"]
exclude = []
mode = "copy"
target_dir = "assets"

[sections.docs]
include = ["README.md", "docs/**"]
exclude = []

[sections.src]
include = ["src/**"]
exclude = []

[manifest]
format = "json"
include_file_sha256 = true
include_output_sha256 = true
include_output_spans = true
include_source_metadata = true${linkedNotesConfig}
`,
    "utf8",
  );

  return { root, configPath, bundleDir };
}

async function tamperSectionOutput(
  bundleDir: string,
  sectionName: string,
  from: string,
  to: string,
): Promise<void> {
  const { manifest } = await loadManifestFromBundle(bundleDir);
  const section = manifest.sections.find((entry) => entry.name === sectionName);
  if (!section) {
    throw new Error(`Missing section ${sectionName} in bundle.`);
  }

  const sectionPath = path.join(bundleDir, section.outputFile);
  const source = await fs.readFile(sectionPath, "utf8");
  if (!source.includes(from)) {
    throw new Error(`Missing tamper target in ${section.outputFile}.`);
  }
  await fs.writeFile(sectionPath, source.replace(from, to), "utf8");
}

describe("bundle workflow", () => {
  test("creates, validates, lists, and verifies a bundle", async () => {
    const project = await createProject();
    const logs: string[] = [];
    const consoleLog = console.log;
    console.log = ((...args: unknown[]) => {
      logs.push(args.map((value) => String(value)).join(" "));
    }) as typeof console.log;

    try {
      expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    } finally {
      console.log = consoleLog;
    }

    const summary = logs.join("\n");
    expect(summary).toContain("Packed tokens");
    expect(summary).toContain("Output tokens");
    expect(summary).toContain("Immutable snapshot");
    expect(summary).toContain("Use MCP");
    expect(await runValidateCommand({ bundleDir: project.bundleDir })).toBe(0);
    expect(await runVerifyCommand({ bundleDir: project.bundleDir })).toBe(0);

    const listWrites: string[] = [];
    const listStdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      listWrites.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    expect(
      await runListCommand({ bundleDir: project.bundleDir, json: false }),
    ).toBe(0);
    process.stdout.write = listStdoutWrite;

    expect(listWrites.join("")).toContain("README.md");
    expect(listWrites.join("")).toContain("docs");
    expect(listWrites.join("")).toContain("status");
    expect(listWrites.join("")).not.toContain("kind\tsection\tstored_in");
    const bundleIndexPath = path.join(
      project.bundleDir,
      "demo-bundle-index.txt",
    );
    expect(await fs.stat(bundleIndexPath)).toBeDefined();
    const bundleIndex = await fs.readFile(bundleIndexPath, "utf8");
    expect(bundleIndex).toContain("cx bundle index");
    expect(bundleIndex).toContain("demo-repomix-docs.xml.txt");
    expect(bundleIndex).toContain("demo-repomix-src.xml.txt");
    expect(
      await fs.stat(path.join(project.bundleDir, "demo-manifest.json")),
    ).toBeDefined();
    expect(
      await fs.stat(path.join(project.bundleDir, "demo.sha256")),
    ).toBeDefined();
  });

  test("records note summaries in the manifest", async () => {
    const project = await createProject();
    await fs.mkdir(path.join(project.root, "notes"), { recursive: true });
    await fs.writeFile(
      path.join(project.root, "notes", "summary-note.md"),
      `---
id: 20260413123030
aliases: []
tags: []
---

# Summary Note

This note explains the first useful idea.
It should become the manifest summary.

## Links

- [[README.md]] - related context
`,
      "utf8",
    );

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);

    const { manifest } = await loadManifestFromBundle(project.bundleDir);
    expect(manifest.notes).toHaveLength(1);
    expect(manifest.notes?.[0]?.summary).toBe(
      "This note explains the first useful idea. It should become the manifest summary.",
    );
  });

  test("pulls linked notes into the bundle when enabled", async () => {
    const project = await createProject({
      includeLinkedNotes: true,
    });

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);

    const { manifest } = await loadManifestFromBundle(project.bundleDir);
    const docsSection = manifest.sections.find((section) => section.name === "docs");
    expect(docsSection?.files.map((file) => file.path)).toContain(
      "notes/linked-note.md",
    );

    const docsOutput = await fs.readFile(
      path.join(project.bundleDir, docsSection?.outputFile ?? ""),
      "utf8",
    );
    expect(docsOutput).toContain("This note is linked from source code.");
  });

  test("emits absolute output spans from renderWithMap for all files", async () => {
    const project = await createProject();

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
    "markdown",
    "plain",
  ] as const)("emits absolute output spans for %s bundles", async (style:
    | "markdown"
    | "plain") => {
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
      configContents.replace('style = "xml"', `style = "${style}"`),
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
      const output =
        outputFile !== undefined ? outputByFile.get(outputFile) : undefined;
      expect(output).toBeDefined();
      expect(row.outputStartLine).toBe(
        findExpectedContentStartLine({
          output: output as string,
          style,
          filePath: row.path,
        }),
      );
    }
  });

  test("does not emit output spans for json bundles", async () => {
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
    const configContents = await fs.readFile(project.configPath, "utf8");
    await fs.writeFile(
      project.configPath,
      configContents.replace('style = "xml"', 'style = "json"'),
      "utf8",
    );

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);

    const { manifest } = await loadManifestFromBundle(project.bundleDir);
    const textRows = manifest.files.filter((row) => row.kind === "text");
    expect(textRows.length).toBeGreaterThan(0);
    for (const row of textRows) {
      expect(row.outputStartLine).toBeNull();
      expect(row.outputEndLine).toBeNull();
    }
  });

  test("nests files inside their section in the JSON manifest", () => {
    const manifest: CxManifest = {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
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
        tokenEncoding: "o200k_base",
        showLineNumbers: false,
        includeEmptyDirectories: false,
        securityCheck: false,
        normalizationPolicy: "repomix-default-v1",
        includeLinkedNotes: false,
      },
      totalTokenCount: 20,
      vcsProvider: "none",
      dirtyState: "clean",
      modifiedFiles: [],
      sections: [
        {
          name: "docs",
          style: "xml",
          outputFile: "myproject-repomix-docs.xml.txt",
          outputSha256: "aaa",
          fileCount: 2,
          tokenCount: 7,
          files: [
            {
              path: "docs/a.md",
              kind: "text",
              section: "docs",
              storedIn: "packed",
              sha256: "sha1",
              sizeBytes: 1,
              tokenCount: 3,
              mtime: "2026-04-11T00:00:00.000Z",
              mediaType: "text/markdown",
              outputStartLine: 5,
              outputEndLine: 5,
            },
            {
              path: "docs/b.md",
              kind: "text",
              section: "docs",
              storedIn: "packed",
              sha256: "sha2",
              sizeBytes: 1,
              tokenCount: 4,
              mtime: "2026-04-11T00:00:00.000Z",
              mediaType: "text/markdown",
              outputStartLine: 6,
              outputEndLine: 6,
            },
          ],
        },
        {
          name: "src",
          style: "xml",
          outputFile: "myproject-repomix-src.xml.txt",
          outputSha256: "bbb",
          fileCount: 1,
          tokenCount: 5,
          files: [
            {
              path: "src/c.ts",
              kind: "text",
              section: "src",
              storedIn: "packed",
              sha256: "sha3",
              sizeBytes: 1,
              tokenCount: 5,
              mtime: "2026-04-11T00:00:00.000Z",
              mediaType: "text/typescript",
              outputStartLine: 10,
              outputEndLine: 10,
            },
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

  test("manifest file is valid JSON with correct schemaVersion and object-list structure", async () => {
    const project = await createProject();
    expect(await runBundleCommand({ config: project.configPath })).toBe(0);

    const entries = await fs.readdir(project.bundleDir);
    const manifestName = entries.find((e) => e.endsWith("-manifest.json"));
    expect(manifestName).toBeDefined();

    const source = await fs.readFile(
      path.join(project.bundleDir, manifestName as string),
      "utf8",
    );

    // Must be valid JSON.
    const parsed = JSON.parse(source) as Record<string, unknown>;

    // Schema version matches the exported constant.
    expect(parsed.schemaVersion).toBe(MANIFEST_SCHEMA_VERSION);

    // Every section must expose a standard object list.
    const sections = parsed.sections as Array<{ files?: unknown[] }>;
    expect(sections.length).toBeGreaterThan(0);
    for (const section of sections) {
      expect(section.files).toBeDefined();
      expect(Array.isArray(section.files)).toBe(true);
    }
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
        .find((file) => file.relativePath === "src/index.ts")?.extractability
        ?.status,
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
    expect(
      listPayload.files?.find((file) => file.path === "src/index.ts")?.status,
    ).toBe("intact");
    expect(inspectPayload.bundleComparison?.available).toBe(true);
  });

  test("includes checksum prefixes in inspect JSON for degraded files", async () => {
    const project = await createProject();
    const writes: string[] = [];
    const stdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    try {
      expect(await runBundleCommand({ config: project.configPath })).toBe(0);
      await tamperSectionOutput(
        project.bundleDir,
        "src",
        'export const demo = "================";\n',
        'export const demo = "tampered";\n',
      );
      expect(
        await runInspectCommand({ config: project.configPath, json: true }),
      ).toBe(0);
    } finally {
      process.stdout.write = stdoutWrite;
    }

    const payload = JSON.parse(writes.pop() ?? "{}") as {
      sections?: Array<{
        files?: Array<{
          relativePath?: string;
          extractability?: {
            status?: string;
            reason?: string;
            expectedSha256?: string;
            actualSha256?: string;
          } | null;
        }>;
      }>;
    };

    const degradedFile = payload.sections
      ?.flatMap((section) => section.files ?? [])
      .find((file) => file.relativePath === "src/index.ts");

    expect(degradedFile?.extractability?.status).toBe("degraded");
    expect(degradedFile?.extractability?.reason).toBe("manifest_hash_mismatch");
    expect(degradedFile?.extractability?.expectedSha256).toBeDefined();
    expect(degradedFile?.extractability?.actualSha256).toBeDefined();
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
    expect(output).toContain("workflow: static snapshot planning");
    expect(output).toContain("mcp: use cx mcp for live workspace exploration");
    expect(output).toContain("intact   src/index.ts");
    expect(output).toContain("copied   logo.png");
  });

  test("shows checksum prefixes in degraded inspect output", async () => {
    const project = await createProject();
    const writes: string[] = [];
    const stdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    try {
      expect(await runBundleCommand({ config: project.configPath })).toBe(0);
      await tamperSectionOutput(
        project.bundleDir,
        "src",
        'export const demo = "================";\n',
        'export const demo = "tampered";\n',
      );
      expect(
        await runInspectCommand({ config: project.configPath, json: false }),
      ).toBe(0);
    } finally {
      process.stdout.write = stdoutWrite;
    }

    const output = writes.join("");
    expect(output).toContain("manifest_hash_mismatch");
    expect(output).toMatch(/expected [a-f0-9]{8}… got [a-f0-9]{8}…/);
  });

  test("renders token breakdown histogram when requested", async () => {
    const project = await createProject();
    const writes: string[] = [];
    const stdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    try {
      expect(
        await runInspectCommand({
          config: project.configPath,
          json: false,
          tokenBreakdown: true,
        }),
      ).toBe(0);
    } finally {
      process.stdout.write = stdoutWrite;
    }

    const output = writes.join("");
    expect(output).toContain("Token breakdown");
    expect(output).toContain("SECTION  TOKENS   SHARE   GRAPH");
    expect(output).toContain("docs");
    expect(output).toContain("src");
    expect(output).toContain("█");
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
      "core contract with optional structured rendering and span capture",
    );
    expect(bundlePayload.repomix?.packageVersion).toMatch(
      /^[0-9]+\.[0-9]+\.[0-9]+-cx\.[0-9]+$/,
    );
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
      schemaVersion?: number;
      bundleVersion?: number;
      summary?: {
        manifestName?: string;
        sectionCount?: number;
        fileCount?: number;
      };
    };

    expect(payload.valid).toBe(true);
    expect(payload.checksumFile).toBe("demo.sha256");
    expect(payload.schemaVersion).toBe(MANIFEST_SCHEMA_VERSION);
    expect(payload.bundleVersion).toBe(1);
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

    await expectExtractedFilesToMatchManifest({
      bundleDir: project.bundleDir,
      restoreDir,
    });
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

    await expectExtractedFilesToMatchManifest({
      bundleDir: project.bundleDir,
      restoreDir,
    });
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

    await expectExtractedFilesToMatchManifest({
      bundleDir: project.bundleDir,
      restoreDir,
    });
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

    await expectExtractedFilesToMatchManifest({
      bundleDir: project.bundleDir,
      restoreDir,
    });
  });

  test("fails bundle creation when text sections disable output spans", async () => {
    const project = await createProject();
    await fs.writeFile(
      project.configPath,
      (await fs.readFile(project.configPath, "utf8")).replace(
        "include_output_spans = true",
        "include_output_spans = false",
      ),
      "utf8",
    );

    await expect(
      runBundleCommand({ config: project.configPath }),
    ).rejects.toThrow("require manifest.include_output_spans = true");
  });

  test("allows json-only bundles when output spans are disabled", async () => {
    const project = await createProject();
    const restoreDir = path.join(project.root, "restored-json-no-spans");
    await fs.writeFile(
      project.configPath,
      (await fs.readFile(project.configPath, "utf8"))
        .replace('style = "xml"', 'style = "json"')
        .replace("include_output_spans = true", "include_output_spans = false"),
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
      }),
    ).toBe(0);

    const { manifest } = await loadManifestFromBundle(project.bundleDir);
    for (const row of manifest.files.filter((entry) => entry.kind === "text")) {
      expect(row.outputStartLine).toBeNull();
      expect(row.outputEndLine).toBeNull();
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

  test("--update prunes orphaned outputs after config changes", async () => {
    const project = await createProject();
    expect(await runBundleCommand({ config: project.configPath })).toBe(0);

    const preservedSectionPath = path.join(
      project.bundleDir,
      "demo-repomix-src.xml.txt",
    );
    const preservedBefore = await sha256File(preservedSectionPath);
    const orphanedAssetPath = path.join(
      project.bundleDir,
      "assets",
      "logo.png",
    );
    expect(await fs.stat(orphanedAssetPath)).toBeDefined();

    await fs.writeFile(
      project.configPath,
      (await fs.readFile(project.configPath, "utf8")).replace(
        'include = ["**/*.png"]',
        "include = []",
      ),
      "utf8",
    );

    expect(
      await runBundleCommand({ config: project.configPath, update: true }),
    ).toBe(0);

    await expect(fs.stat(orphanedAssetPath)).rejects.toThrow();
    const preservedAfter = await sha256File(preservedSectionPath);
    expect(preservedAfter).toBe(preservedBefore);
  });

  test("--update refuses to prune non-bundle directories", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-update-safety-"));
    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.writeFile(
      path.join(root, "src", "index.ts"),
      "export const x = 1;\n",
      "utf8",
    );
    await fs.writeFile(path.join(root, "README.md"), "# keep\n", "utf8");
    const configPath = path.join(root, "cx.toml");
    await fs.writeFile(
      configPath,
      `schema_version = 1
project_name = "demo"
source_root = "."
output_dir = "."

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

    await expect(
      runBundleCommand({ config: configPath, update: true }),
    ).rejects.toThrow("Refusing --update prune");
    expect(await fs.readFile(path.join(root, "README.md"), "utf8")).toBe(
      "# keep\n",
    );
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
    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    await tamperSectionOutput(
      project.bundleDir,
      "src",
      'export const demo = "================";\n',
      'export const demo = "tampered";\n',
    );
    // The command now formats a visual table and returns the exit code instead of throwing.
    const exitCode = await runExtractCommand({
      bundleDir: project.bundleDir,
      destinationDir: restoreDir,
      sections: undefined,
      files: ["src/index.ts"],
      assetsOnly: false,
      overwrite: false,
      verify: false,
    });
    expect(exitCode).toBe(8);
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

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    await tamperSectionOutput(
      project.bundleDir,
      "src",
      'export const demo = "================";\n',
      'export const demo = "tampered";\n',
    );
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

  test("surfaces checksum prefixes for long special paths", async () => {
    const project = await createProject({ includeSpecialChecksumFile: true });
    const restoreDir = path.join(project.root, "restored-special");
    const writes: string[] = [];
    const stderrWrite = process.stderr.write;
    process.stderr.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    await tamperSectionOutput(
      project.bundleDir,
      "src",
      "export const special = true;\n",
      "export const special = false;\n",
    );
    try {
      expect(
        await runExtractCommand({
          bundleDir: project.bundleDir,
          destinationDir: restoreDir,
          sections: undefined,
          files: ["src/special cases/checksum + edge.ts"],
          assetsOnly: false,
          overwrite: false,
          verify: false,
        }),
      ).toBe(8);
    } finally {
      process.stderr.write = stderrWrite;
    }

    const output = writes.join("");
    expect(output).toContain("src/special cases/checksum + edge.ts");
    expect(output).toMatch(/expected [a-f0-9]{8}… got [a-f0-9]{8}…/);
  });

  test("surfaces blocked extractability in list JSON before extraction", async () => {
    const project = await createProject();
    const writes: string[] = [];
    const stdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    await tamperSectionOutput(
      project.bundleDir,
      "src",
      'export const demo = "================";\n',
      'export const demo = "tampered";\n',
    );
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
        extractability?: {
          status?: string;
          reason?: string;
          expectedSha256?: string;
          actualSha256?: string;
        };
      }>;
    };

    expect(payload.files?.[0]?.path).toBe("src/index.ts");
    expect(payload.files?.[0]?.status).toBe("degraded");
    expect(payload.files?.[0]?.extractability?.status).toBe("degraded");
    expect(payload.files?.[0]?.extractability?.reason).toBe(
      "manifest_hash_mismatch",
    );
    expect(payload.files?.[0]?.extractability?.expectedSha256).toBeDefined();
    expect(payload.files?.[0]?.extractability?.actualSha256).toBeDefined();
  });

  test("extracts degraded files with explicit opt-in", async () => {
    const project = await createProject();
    const restoreDir = path.join(project.root, "restored-degraded");
    expect(await runBundleCommand({ config: project.configPath })).toBe(0);
    await tamperSectionOutput(
      project.bundleDir,
      "src",
      'export const demo = "================";\n',
      'export const demo = "tampered";\n',
    );
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
    ).not.toBe(
      await fs.readFile(path.join(project.root, "src", "index.ts"), "utf8"),
    );
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
