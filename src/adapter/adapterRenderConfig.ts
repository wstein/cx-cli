import path from "node:path";

import { buildSectionHandoverText } from "../render/sectionHandover.js";
import type { RenderSectionInput } from "../render/types.js";
import type { AdapterRenderConfig } from "./types.js";

export function buildAdapterRenderConfig(
  params: RenderSectionInput,
): AdapterRenderConfig {
  return {
    output: {
      filePath: params.outputPath,
      style: params.style,
      parsableStyle: params.style === "json",
      headerText: buildSectionHandoverText({
        projectName: params.config.projectName,
        sectionName: params.sectionName,
        ...(path.basename(params.outputPath) === "output"
          ? {}
          : { outputFile: path.basename(params.outputPath) }),
        fileCount: params.explicitFiles.length,
        style: params.style,
        ...(params.handoverFile === undefined
          ? {}
          : { handoverFile: params.handoverFile }),
      }),
      fileSummary: true,
      directoryStructure: true,
      files: true,
      removeComments: false,
      removeEmptyLines: false,
      compress: false,
      showLineNumbers: params.config.repomix.showLineNumbers,
      copyToClipboard: false,
      includeEmptyDirectories: params.config.repomix.includeEmptyDirectories,
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
      enableSecurityCheck: params.config.repomix.securityCheck,
    },
    tokenCount: {
      encoding: params.config.tokens.encoding,
    },
  };
}
