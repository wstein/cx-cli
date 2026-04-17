import fs from "node:fs/promises";
import path from "node:path";

import type * as RepomixTypes from "@wsmy/repomix-cx-fork";

import type { CxConfig, CxStyle } from "../config/types.js";
import { CxError } from "../shared/errors.js";
import { sha256Text } from "../shared/hashing.js";
import { countTokensForFiles } from "../shared/tokens.js";
import {
  detectRepomixCapabilities,
  getAdapterModulePath,
  getRepomixCapabilities as getRepomixCapabilitiesImpl,
  validateRepomixContract,
} from "./capabilities.js";
import { buildSectionHeaderText } from "./handover.js";
import {
  computePlanHash,
  extractStructuredPlan,
  planToMaps,
  type StructuredRenderPlan,
} from "./structured.js";

export interface RenderSectionResult {
  outputText: string;
  outputTokenCount: number;
  fileTokenCounts: Map<string, number>;
  fileContentHashes: Map<string, string>;
  fileSpans?: Map<string, { outputStartLine: number; outputEndLine: number }>;
  structuredPlan?: StructuredRenderPlan;
  planHash?: string;
  warnings: string[];
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

/** Load the configured Repomix adapter module at runtime. */
async function loadRepomixAdapter(): Promise<typeof RepomixTypes> {
  // Dynamic import honours any --adapter-path override set before command dispatch.
  // The cast is safe: the adapter is expected to satisfy the RepomixTypes interface.
  return import(getAdapterModulePath()) as Promise<typeof RepomixTypes>;
}

export const REPOMIX_ADAPTER_CONTRACT = "repomix-pack-v1";

function emitWarning(message: string): void {
  process.stderr.write(`Warning: ${message}\n`);
}

// Re-export with extended info for backward compatibility
export async function getRepomixCapabilities() {
  const capabilities = await getRepomixCapabilitiesImpl();
  const detected = await detectRepomixCapabilities();

  // Determine span capability state
  let spanCapability: "supported" | "unsupported" | "partial" = "unsupported";
  let spanCapabilityReason =
    "Structured span capture is unavailable in the installed adapter.";

  if (detected.supportsRenderWithMap) {
    spanCapability = "supported";
    spanCapabilityReason = "renderWithMap available and used";
  } else if (detected.supportsPackStructured) {
    spanCapability = "partial";
    spanCapabilityReason =
      "packStructured is available, but renderWithMap is unavailable.";
  }

  return {
    ...capabilities,
    adapterContract: REPOMIX_ADAPTER_CONTRACT,
    compatibilityStrategy:
      "core contract with optional structured rendering and span capture",
    spanCapability,
    spanCapabilityReason,
  };
}

async function assertCompatibleRepomixAdapter(): Promise<void> {
  const validation = await validateRepomixContract();
  if (!validation.valid) {
    throw new CxError(
      `Incompatible Repomix adapter contract:\n${validation.errors.join("\n")}`,
      5,
    );
  }
}

export async function renderSectionWithRepomix(params: {
  config: CxConfig;
  style: CxStyle;
  sourceRoot: string;
  outputPath: string;
  sectionName: string;
  explicitFiles: string[];
  bundleIndexFile?: string;
  requireStructured?: boolean;
  requireOutputSpans?: boolean;
}): Promise<RenderSectionResult> {
  await assertCompatibleRepomixAdapter();

  if (params.explicitFiles.length === 0) {
    await fs.writeFile(params.outputPath, "", "utf8");
    return {
      outputText: "",
      outputTokenCount: 0,
      fileTokenCounts: new Map(),
      fileContentHashes: new Map(),
      fileSpans: new Map(),
      warnings: [],
    };
  }

  const adapter = await loadRepomixAdapter();
  const { mergeConfigs, pack, packStructured } = adapter;
  const capabilities = await detectRepomixCapabilities();
  const needsOutputSpans = params.requireOutputSpans ?? false;

  const cliConfig: Parameters<typeof mergeConfigs>[2] = {
    output: {
      filePath: params.outputPath,
      style: params.style,
      parsableStyle: params.style === "json",
      headerText: buildSectionHeaderText({
        projectName: params.config.projectName,
        sectionName: params.sectionName,
        ...(path.basename(params.outputPath) === "output"
          ? {}
          : { outputFile: path.basename(params.outputPath) }),
        fileCount: params.explicitFiles.length,
        style: params.style,
        ...(params.bundleIndexFile === undefined
          ? {}
          : { bundleIndexFile: params.bundleIndexFile }),
      }),
      fileSummary: true,
      directoryStructure: true,
      files: true,
      // Compression transforms must never be delegated to Repomix: they alter line
      // coordinates, violate cryptographic invariants, and would overwrite source
      // files with minified content on extraction. These are unconditionally false.
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

  const mergedConfig = mergeConfigs(params.sourceRoot, {}, cliConfig);
  const warnings: string[] = [];

  if (!capabilities.supportsPackStructured) {
    const message =
      "Repomix adapter is missing the cx extension (packStructured). Install @wsmy/repomix-cx-fork or set repomix.missing_extension=warn to degrade gracefully.";

    if (params.config.behavior.repomixMissingExtension === "fail") {
      throw new CxError(message, 5);
    }

    emitWarning(message);
  }

  if (capabilities.supportsPackStructured && packStructured) {
    const structuredPack = await packStructured(
      [params.sourceRoot],
      mergedConfig,
      {
        explicitFiles: params.explicitFiles,
      },
    );

    // Extract structured plan with deterministic ordering and hashes
    const plan = extractStructuredPlan(structuredPack);
    const planHash = computePlanHash(plan);
    const { fileTokenCounts, fileContentHashes } = planToMaps(plan);

    if (
      params.config.manifest.includeOutputSpans &&
      params.style !== "json" &&
      typeof structuredPack.renderWithMap === "function"
    ) {
      const rendered = await structuredPack.renderWithMap(params.style);
      await fs.writeFile(params.outputPath, rendered.output, "utf8");

      const entryByPath = new Map(
        structuredPack.entries.map((entry) => [entry.path, entry]),
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

      return {
        outputText: rendered.output,
        outputTokenCount: [...fileTokenCounts.values()].reduce(
          (sum, tokenCount) => sum + tokenCount,
          0,
        ),
        fileTokenCounts,
        fileContentHashes,
        fileSpans,
        structuredPlan: plan,
        planHash,
        warnings,
      };
    }

    if (params.config.manifest.includeOutputSpans && params.style !== "json") {
      if (needsOutputSpans) {
        throw new CxError(
          "Text sections require exact output spans, but the Repomix adapter cannot capture them.",
          5,
        );
      }

      const message =
        "Exact output spans are unavailable for this render; text bundles now require them.";
      warnings.push(message);
      emitWarning(message);
    }

    const outputText = await structuredPack.render(params.style);
    await fs.writeFile(params.outputPath, outputText, "utf8");

    return {
      outputText,
      outputTokenCount: [...fileTokenCounts.values()].reduce(
        (sum, tokenCount) => sum + tokenCount,
        0,
      ),
      fileTokenCounts,
      fileContentHashes,
      fileSpans: new Map(),
      structuredPlan: plan,
      planHash,
      warnings,
    };
  }

  if (params.requireStructured) {
    throw new CxError(
      "Incompatible Repomix adapter: packStructured() is required for normalized content hashing.",
      5,
    );
  }

  if (!pack) {
    throw new CxError(
      "Incompatible Repomix adapter: neither packStructured() nor pack() is available for rendering.",
      5,
    );
  }

  if (params.config.manifest.includeOutputSpans && params.style !== "json") {
    if (needsOutputSpans) {
      throw new CxError(
        "Text sections require exact output spans, but the Repomix adapter cannot capture them.",
        5,
      );
    }

    const message =
      "Exact output spans are unavailable for this render; text bundles now require them.";
    warnings.push(message);
    emitWarning(message);
  }

  await pack(
    [params.sourceRoot],
    mergedConfig,
    () => {},
    {},
    params.explicitFiles,
  );
  const outputText = await fs.readFile(params.outputPath, "utf8");
  const countsByAbsolutePath = await countTokensForFiles(
    params.explicitFiles,
    params.config.tokens.encoding,
  );
  const fileTokenCounts = new Map<string, number>();
  for (const absolutePath of params.explicitFiles) {
    const relativePath = path
      .relative(params.sourceRoot, absolutePath)
      .replaceAll("\\", "/");
    fileTokenCounts.set(
      relativePath,
      countsByAbsolutePath.get(absolutePath) ?? 0,
    );
  }

  return {
    outputText,
    outputTokenCount: [...fileTokenCounts.values()].reduce(
      (sum, tokenCount) => sum + tokenCount,
      0,
    ),
    fileTokenCounts,
    fileContentHashes: new Map(),
    fileSpans: new Map(),
    warnings,
  };
}
