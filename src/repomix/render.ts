import fs from "node:fs/promises";

import { mergeConfigs, pack, packStructured } from "@wstein/repomix";

import type { CxConfig, CxStyle } from "../config/types.js";
import { CxError } from "../shared/errors.js";
import {
  detectRepomixCapabilities,
  getRepomixCapabilities as getRepomixCapabilitiesImpl,
  validateRepomixContract,
} from "./capabilities.js";

export interface RenderSectionResult {
  outputText: string;
  fileSpans?: Map<string, { outputStartLine: number; outputEndLine: number }>;
}

function countLogicalLines(content: string): number {
  if (content === "") {
    return 0;
  }

  const lines = content.split("\n");
  return content.endsWith("\n") ? lines.length - 1 : lines.length;
}

export const CX_VERSION = "0.1.0";
export const REPOMIX_ADAPTER_CONTRACT = "repomix-pack-v1";

// Re-export with extended info for backward compatibility
export async function getRepomixCapabilities() {
  const capabilities = await getRepomixCapabilitiesImpl();
  const detected = detectRepomixCapabilities();

  // Determine span capability state
  let spanCapability: "supported" | "unsupported" | "partial" = "unsupported";
  let spanCapabilityReason = "renderWithMap not available in installed package";

  if (detected.supportsRenderWithMap) {
    spanCapability = "supported";
    spanCapabilityReason = "renderWithMap available and used";
  }

  return {
    ...capabilities,
    adapterContract: REPOMIX_ADAPTER_CONTRACT,
    compatibilityStrategy: "capability-aware with renderWithMap support",
    spanCapability,
    spanCapabilityReason,
  };
}

function assertCompatibleRepomixAdapter(): void {
  const validation = validateRepomixContract();
  if (!validation.valid) {
    throw new CxError(
      `Incompatible @wstein/repomix adapter contract:\n${validation.errors.join("\n")}`,
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
}): Promise<RenderSectionResult> {
  assertCompatibleRepomixAdapter();

  if (params.explicitFiles.length === 0) {
    await fs.writeFile(params.outputPath, "", "utf8");
    return { outputText: "", fileSpans: new Map() };
  }

  const cliConfig: Parameters<typeof mergeConfigs>[2] = {
    output: {
      filePath: params.outputPath,
      style: params.style,
      parsableStyle: params.style === "json",
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

  // When span capture is needed, use packStructured with renderWithMap
  if (params.config.manifest.includeOutputSpans) {
    const structuredPlan = await packStructured(
      [params.sourceRoot],
      mergedConfig,
      {
        explicitFiles: params.explicitFiles,
      },
    );

    const rendered = await structuredPlan.renderWithMap(params.style);
    await fs.writeFile(params.outputPath, rendered.output, "utf8");

    // Derive spans from bare file content so wrapper lines do not affect line numbers.
    const fileSpans = new Map<
      string,
      { outputStartLine: number; outputEndLine: number }
    >();
    let currentLine = 1;
    for (const span of rendered.files) {
      const entry = structuredPlan.entries.find(
        (file) => file.path === span.path,
      );
      const logicalLineCount = countLogicalLines(entry?.content ?? "");
      const spanLength = Math.max(logicalLineCount, 1);
      fileSpans.set(span.path, {
        outputStartLine: currentLine,
        outputEndLine: currentLine + spanLength - 1,
      });
      currentLine += spanLength;
    }

    return { outputText: rendered.output, fileSpans };
  }

  // For backward compatibility: use pack() when spans are not needed
  await pack(
    [params.sourceRoot],
    mergedConfig,
    () => {},
    {},
    params.explicitFiles,
  );

  return { outputText: await fs.readFile(params.outputPath, "utf8") };
}
