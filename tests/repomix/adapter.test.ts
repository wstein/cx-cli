import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { mergeConfigs, packStructured } from "@wstein/repomix";
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
});
