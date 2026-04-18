// test-lane: integration
import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";

import { mergeConfigs, packStructured } from "@wsmy/repomix-cx-fork";
import {
  getRepomixCapabilities,
  REPOMIX_ADAPTER_CONTRACT,
  renderSectionWithRepomix,
} from "../../src/repomix/render.js";
import { createRenderFixture } from "./helpers.js";

describe("Repomix adapter capabilities", () => {
  test("exports the public mergeConfigs and packStructured functions", () => {
    expect(typeof mergeConfigs).toBe("function");
    expect(typeof packStructured).toBe("function");
  });

  test("packStructured supports the public call shape used by cx", async () => {
    const fixture = await createRenderFixture();
    const outputPath = path.join(fixture.rootDir, "repomix-output.xml.txt");
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

    const merged = mergeConfigs(fixture.rootDir, {}, cliConfig);
    const plan = await packStructured([fixture.rootDir], merged, {
      explicitFiles: [path.join(fixture.rootDir, "src", "index.ts")],
    });
    const rendered = await plan.renderWithMap("xml");
    await fs.writeFile(outputPath, rendered.output, "utf8");

    expect((await getRepomixCapabilities()).adapterContract).toBe(
      REPOMIX_ADAPTER_CONTRACT,
    );
    expect(await fs.stat(outputPath)).toBeDefined();
  });

  test("renderSectionWithRepomix returns an empty render for zero files", async () => {
    const fixture = await createRenderFixture();
    const result = await renderSectionWithRepomix({
      config: fixture.config,
      style: "xml",
      sourceRoot: fixture.rootDir,
      outputPath: fixture.outputPath,
      sectionName: "src",
      explicitFiles: [],
    });

    expect(result.outputText).toBe("");
    expect(result.outputTokenCount).toBe(0);
    expect(result.fileTokenCounts.size).toBe(0);
    expect(result.fileContentHashes.size).toBe(0);
    expect(await fs.readFile(fixture.outputPath, "utf8")).toBe("");
  });
});
