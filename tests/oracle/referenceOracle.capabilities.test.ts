// test-lane: integration

import fs from "node:fs/promises";
import path from "node:path";
import { mergeConfigs, runSecurityCheck } from "repomix";
import { describe, expect, test } from "vitest";
import {
  ADAPTER_CONTRACT,
  getOracleAdapterCapabilities,
} from "../../src/adapter/capabilities.js";
import { renderSectionWithAdapterOracle } from "../../src/adapter/oracleRender.js";
import { createRenderFixture } from "./helpers.js";

describe("official reference-oracle capabilities", () => {
  test("exports the public mergeConfigs and security-check functions", () => {
    expect(typeof mergeConfigs).toBe("function");
    expect(typeof runSecurityCheck).toBe("function");
  });

  test("reference oracle does not expose the cx-only packStructured extension", () => {
    expect("packStructured" in { mergeConfigs, runSecurityCheck }).toBe(false);
  });

  test("runSecurityCheck supports the public call shape used by cx oracle diagnostics", async () => {
    const fixture = await createRenderFixture();
    const cliConfig: Parameters<typeof mergeConfigs>[2] = {
      output: {
        filePath: path.join(fixture.rootDir, "repomix-output.xml.txt"),
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
    expect(merged.output.filePath).toContain("repomix-output.xml.txt");
    const suspiciousFiles = await runSecurityCheck([
      {
        path: "src/secrets.env",
        content:
          "AWS_SECRET_ACCESS_KEY=abcdefghijklmnopqrstuvwxyz1234567890ABCD\n",
      },
      {
        path: "src/index.ts",
        content: await fs.readFile(
          path.join(fixture.rootDir, "src", "index.ts"),
          "utf8",
        ),
      },
    ]);

    expect(
      (await getOracleAdapterCapabilities()).oracleAdapter.adapterContract,
    ).toBe(ADAPTER_CONTRACT);
    expect(suspiciousFiles).toEqual([
      {
        filePath: "src/secrets.env",
        messages: [
          "found AWS Secret Access Key: abcdefghijklmnopqrstuvwxyz1234567890ABCD",
        ],
        type: "file",
      },
    ]);
  });

  test("renderSectionWithAdapterOracle returns an empty render for zero files", async () => {
    const fixture = await createRenderFixture();
    const result = await renderSectionWithAdapterOracle({
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
