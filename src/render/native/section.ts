import fs from "node:fs/promises";
import path from "node:path";

import { computePlanHash, planToMaps } from "../planHash.js";
import { buildSectionHandoverText } from "../sectionHandover.js";
import { buildStructuredPlanFromFiles } from "../structuredPlan.js";
import type { RenderSectionInput, RenderSectionResult } from "../types.js";
import { renderNativeJsonSection } from "./json.js";
import { renderNativeMarkdownSection } from "./markdown.js";
import { renderNativePlainSection } from "./plain.js";
import { renderNativeXmlSection } from "./xml.js";

export function createNativeRenderSectionFn(): (
  input: RenderSectionInput,
) => Promise<RenderSectionResult> {
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

    const plan = await buildStructuredPlanFromFiles({
      sourceRoot: input.sourceRoot,
      explicitFiles: input.explicitFiles,
      encoding: input.config.tokens.encoding,
    });
    const planHash = computePlanHash(plan);
    const { fileTokenCounts, fileContentHashes } = planToMaps(plan);
    const headerText = buildSectionHandoverText({
      projectName: input.config.projectName,
      sectionName: input.sectionName,
      ...(path.basename(input.outputPath) === "output"
        ? {}
        : { outputFile: path.basename(input.outputPath) }),
      fileCount: input.explicitFiles.length,
      style: input.style,
      ...(input.handoverFile === undefined
        ? {}
        : { handoverFile: input.handoverFile }),
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
