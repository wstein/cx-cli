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

function countNewlines(content: string): number {
  let count = 0;
  for (const character of content) {
    if (character === "\n") {
      count += 1;
    }
  }
  return count;
}

function countLogicalLines(content: string): number {
  if (content === "") {
    return 0;
  }

  const lines = content.split("\n");
  return content.endsWith("\n") ? lines.length - 1 : lines.length;
}

function findContentStartOffset(params: {
  style: CxStyle;
  block: string;
  filePath: string;
}): number {
  const { style, block, filePath } = params;

  if (style === "xml") {
    const tag = `<file path="${filePath}">`;
    const tagStart = block.indexOf(tag);
    if (tagStart === -1) {
      throw new CxError(
        `Unable to locate XML file wrapper while computing output spans for ${filePath}`,
        5,
      );
    }

    let contentStart = tagStart + tag.length;
    if (block[contentStart] === "\n") {
      contentStart += 1;
    }

    return contentStart;
  }

  if (style === "markdown") {
    const heading = `## File: ${filePath}\n`;
    const headingStart = block.indexOf(heading);
    if (headingStart === -1) {
      throw new CxError(
        `Unable to locate Markdown file wrapper while computing output spans for ${filePath}`,
        5,
      );
    }

    const fenceLineEnd = block.indexOf("\n", headingStart + heading.length);
    if (fenceLineEnd === -1) {
      throw new CxError(
        `Unable to locate Markdown fence while computing output spans for ${filePath}`,
        5,
      );
    }

    return fenceLineEnd + 1;
  }

  if (style === "plain") {
    const marker = `================\nFile: ${filePath}\n================\n`;
    const markerStart = block.indexOf(marker);
    if (markerStart === -1) {
      throw new CxError(
        `Unable to locate plain-text file wrapper while computing output spans for ${filePath}`,
        5,
      );
    }

    return markerStart + marker.length;
  }

  // JSON output stores each file in a single object-property line.
  return 0;
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

    // Derive absolute spans for bare content lines inside each rendered file block.
    const entryByPath = new Map(
      structuredPlan.entries.map((entry) => [entry.path, entry]),
    );
    const fileSpans = new Map<
      string,
      { outputStartLine: number; outputEndLine: number }
    >();

    for (const span of rendered.files) {
      const entry = entryByPath.get(span.path);
      const logicalLineCount = countLogicalLines(entry?.content ?? "");
      const spanLength = Math.max(logicalLineCount, 1);

      const block = rendered.output.slice(span.startOffset, span.endOffset);
      const contentStartOffsetInBlock = findContentStartOffset({
        style: params.style,
        block,
        filePath: span.path,
      });
      const outputStartLine =
        span.startLine +
        countNewlines(block.slice(0, contentStartOffsetInBlock));

      fileSpans.set(span.path, {
        outputStartLine,
        outputEndLine: outputStartLine + spanLength - 1,
      });
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
