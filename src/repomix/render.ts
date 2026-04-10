import fs from 'node:fs/promises';

import { mergeConfigs, pack } from 'repomix';

import type { CxConfig, CxStyle } from '../config/types.js';

export const REPOMIX_VERSION = '1.13.1';
export const CX_VERSION = '0.1.0';

export async function renderSectionWithRepomix(params: {
  config: CxConfig;
  style: CxStyle;
  sourceRoot: string;
  outputPath: string;
  explicitFiles: string[];
}): Promise<string> {
  if (params.explicitFiles.length === 0) {
    await fs.writeFile(params.outputPath, '', 'utf8');
    return '';
  }

  const cliConfig: Parameters<typeof mergeConfigs>[2] = {
    output: {
      filePath: params.outputPath,
      style: params.style,
      parsableStyle: params.style === 'xml' || params.style === 'json',
      fileSummary: true,
      directoryStructure: true,
      files: true,
      removeComments: params.config.repomix.removeComments,
      removeEmptyLines: params.config.repomix.removeEmptyLines,
      compress: params.config.repomix.compress,
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
  };

  const mergedConfig = mergeConfigs(params.sourceRoot, {}, cliConfig);
  await pack(
    [params.sourceRoot],
    mergedConfig,
    () => {},
    {},
    params.explicitFiles,
  );

  return fs.readFile(params.outputPath, 'utf8');
}
