import fs from "node:fs/promises";
import path from "node:path";

import type * as RepomixTypes from "@wsmy/repomix-cx-fork";

import {
  getAdapterModulePath,
  validateRepomixContract,
} from "../../repomix/capabilities.js";
import { buildSectionHeaderText } from "../../repomix/handover.js";
import { extractStructuredPlan } from "../../repomix/structured.js";
import { computePlanHash, planToMaps } from "../planHash.js";
import { buildRepomixCliConfig } from "../repomixConfig.js";
import type {
  RenderEngine,
  RenderSectionInput,
  RenderSectionResult,
} from "../types.js";
import { renderNativeJsonSection } from "./json.js";
import { renderNativeMarkdownSection } from "./markdown.js";
import { renderNativePlainSection } from "./plain.js";
import { renderNativeXmlSection } from "./xml.js";

async function loadRepomixAdapter(): Promise<typeof RepomixTypes> {
  return import(getAdapterModulePath()) as Promise<typeof RepomixTypes>;
}

export function createNativeRenderSectionFn(
  fallbackEngine: RenderEngine,
): (input: RenderSectionInput) => Promise<RenderSectionResult> {
  return async (input) => {
    if (input.explicitFiles.length === 0) {
      await fs.writeFile(input.outputPath, "", "utf8");
      return {
        outputText: "",
        outputTokenCount: 0,
        fileTokenCounts: new Map(),
        fileContentHashes: new Map(),
        fileSpans: new Map(),
        warnings: [],
      };
    }

    const validation = await validateRepomixContract();
    if (!validation.valid) {
      return fallbackEngine.renderSection(input);
    }

    const adapter = await loadRepomixAdapter();
    if (typeof adapter.packStructured !== "function") {
      return fallbackEngine.renderSection(input);
    }

    const mergedConfig = adapter.mergeConfigs(
      input.sourceRoot,
      {},
      buildRepomixCliConfig(input),
    );
    const structuredPack = await adapter.packStructured(
      [input.sourceRoot],
      mergedConfig,
      { explicitFiles: input.explicitFiles },
    );
    const plan = extractStructuredPlan(structuredPack);
    const planHash = computePlanHash(plan);
    const { fileTokenCounts, fileContentHashes } = planToMaps(plan);
    const headerText = buildSectionHeaderText({
      projectName: input.config.projectName,
      sectionName: input.sectionName,
      ...(path.basename(input.outputPath) === "output"
        ? {}
        : { outputFile: path.basename(input.outputPath) }),
      fileCount: input.explicitFiles.length,
      style: input.style,
      ...(input.bundleIndexFile === undefined
        ? {}
        : { bundleIndexFile: input.bundleIndexFile }),
    });

    const nativeResult =
      input.style === "xml"
        ? renderNativeXmlSection({
            plan,
            headerText,
            securityCheck: input.config.repomix.securityCheck,
          })
        : input.style === "markdown"
          ? renderNativeMarkdownSection({
              plan,
              headerText,
              securityCheck: input.config.repomix.securityCheck,
            })
          : input.style === "plain"
            ? renderNativePlainSection({
                plan,
                headerText,
              })
            : renderNativeJsonSection({
                plan,
                headerText,
              });

    await fs.writeFile(input.outputPath, nativeResult.outputText, "utf8");

    return {
      outputText: nativeResult.outputText,
      outputTokenCount: [...fileTokenCounts.values()].reduce(
        (sum, tokenCount) => sum + tokenCount,
        0,
      ),
      fileTokenCounts,
      fileContentHashes,
      fileSpans:
        input.style !== "json" && input.config.manifest.includeOutputSpans
          ? nativeResult.fileSpans
          : new Map(),
      structuredPlan: plan,
      planHash,
      warnings: [],
    };
  };
}
