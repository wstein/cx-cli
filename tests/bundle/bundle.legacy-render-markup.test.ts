// test-lane: integration
import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";

import { loadManifestFromBundle } from "../../src/bundle/validate.js";
import { runBundleCommand } from "../../src/cli/commands/bundle.js";
import { runExtractCommand } from "../../src/cli/commands/extract.js";
import {
  createProject,
  findExpectedContentStartLine,
  readLogicalLineCount,
} from "./helpers.js";

describe("bundle legacy render markup", () => {
  test("emits absolute output spans from renderWithMap for all files", async () => {
    const project = await createProject();

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);

    const { manifest } = await loadManifestFromBundle(project.bundleDir);
    const docsSection = manifest.sections.find(
      (entry) => entry.name === "docs",
    );
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
        await readLogicalLineCount(path.join(project.root, "docs/guide.md")),
      ],
      [
        "README.md",
        await readLogicalLineCount(path.join(project.root, "README.md")),
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
      manifest.sections.map((entry) => [entry.name, entry.outputFile]),
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
});
