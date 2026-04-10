import fs from "node:fs/promises";

import { mergeConfigs, pack } from "repomix";

import type { CxConfig, CxStyle } from "../config/types.js";
import { CxError } from "../shared/errors.js";

export const CX_VERSION = "0.1.0";
export const SUPPORTED_REPOMIX_VERSION = "1.13.1";
export const REPOMIX_ADAPTER_CONTRACT = "repomix-pack-v1";
export const REPOMIX_VERSION = "unknown";
export const EXACT_SPAN_CAPTURE_SUPPORTED = false;
export const EXACT_SPAN_CAPTURE_REASON =
  "Repomix public exports do not expose stable render-context hooks for exact output span calculation.";

export function getRepomixCapabilities(): {
  adapterContract: string;
  compatibilityStrategy: string;
  exactSpanCaptureSupported: boolean;
  exactSpanCaptureReason: string;
  supportedRepomixVersion: string;
} {
  return {
    adapterContract: REPOMIX_ADAPTER_CONTRACT,
    compatibilityStrategy: "public-export contract check",
    exactSpanCaptureSupported: EXACT_SPAN_CAPTURE_SUPPORTED,
    exactSpanCaptureReason: EXACT_SPAN_CAPTURE_REASON,
    supportedRepomixVersion: SUPPORTED_REPOMIX_VERSION,
  };
}

function assertCompatibleRepomixAdapter(): void {
  if (typeof mergeConfigs !== "function" || typeof pack !== "function") {
    throw new CxError(
      "Incompatible Repomix adapter contract: required public exports are unavailable.",
      5,
    );
  }
}

export async function renderSectionWithRepomix(params: {
  config: CxConfig;
  style: CxStyle;
  sourceRoot: string;
  outputPath: string;
  explicitFiles: string[];
}): Promise<string> {
  assertCompatibleRepomixAdapter();

  if (params.explicitFiles.length === 0) {
    await fs.writeFile(params.outputPath, "", "utf8");
    return "";
  }

  const cliConfig: Parameters<typeof mergeConfigs>[2] = {
    output: {
      filePath: params.outputPath,
      style: params.style,
      parsableStyle: params.style === "xml" || params.style === "json",
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

  return fs.readFile(params.outputPath, "utf8");
}
