import { loadManifestFromBundle, validateBundle } from "../bundle/validate.js";
import type { CxConfig } from "../config/types.js";
import { resolveExtractability } from "../extract/resolution.js";
import { enrichPlanWithLinkedNotes } from "../notes/planner.js";
import { buildBundlePlan } from "../planning/buildPlan.js";
import type { InclusionProvenance } from "../planning/types.js";
import { countTokensForFiles } from "../shared/tokens.js";

export interface InspectExtractability {
  status: string;
  reason: string;
  message: string;
  expectedSha256?: string;
  actualSha256?: string;
}

interface SectionTokenBreakdown {
  name: string;
  fileCount: number;
  tokenCount: number;
  share: number;
  bar: string;
}

interface TokenBreakdown {
  totalTokenCount: number;
  sections: SectionTokenBreakdown[];
}

export interface InspectReport {
  summary: {
    projectName: string;
    sourceRoot: string;
    bundleDir: string;
    sectionCount: number;
    assetCount: number;
    unmatchedCount: number;
    textFileCount: number;
  };
  bundleComparison:
    | {
        available: true;
        bundleDir: string;
        manifestName: string;
      }
    | {
        available: false;
        bundleDir: string;
        reason: string;
      };
  tokenBreakdown: TokenBreakdown | undefined;
  sections: Array<{
    name: string;
    style: string;
    outputFile: string;
    files: Array<{
      relativePath: string;
      absolutePath: string;
      sizeBytes: number;
      mediaType?: string;
      provenance: InclusionProvenance[];
      extractability: InspectExtractability | null;
    }>;
  }>;
  assets: Array<{
    relativePath: string;
    absolutePath: string;
    storedPath: string;
    sizeBytes: number;
    provenance: InclusionProvenance[];
    extractability: InspectExtractability | null;
  }>;
  unmatchedFiles: string[];
  warnings: string[];
}

function buildInspectSummary(
  plan: Awaited<ReturnType<typeof buildBundlePlan>>,
): InspectReport["summary"] {
  return {
    projectName: plan.projectName,
    sourceRoot: plan.sourceRoot,
    bundleDir: plan.bundleDir,
    sectionCount: plan.sections.length,
    assetCount: plan.assets.length,
    unmatchedCount: plan.unmatchedFiles.length,
    textFileCount: plan.sections.reduce(
      (total, section) => total + section.files.length,
      0,
    ),
  };
}

async function buildTokenBreakdown(
  plan: Awaited<ReturnType<typeof buildBundlePlan>>,
  encoding: string,
): Promise<TokenBreakdown> {
  const sectionTotals = await Promise.all(
    plan.sections.map(async (section) => {
      const counts = await countTokensForFiles(
        section.files.map((file) => file.absolutePath),
        encoding,
      );
      const tokenCount = [...counts.values()].reduce(
        (total, count) => total + count,
        0,
      );
      return {
        name: section.name,
        fileCount: section.files.length,
        tokenCount,
      };
    }),
  );

  const totalTokenCount = sectionTotals.reduce(
    (total, section) => total + section.tokenCount,
    0,
  );
  const maxTokenCount = Math.max(
    1,
    ...sectionTotals.map((section) => section.tokenCount),
  );
  const maxBarWidth = 24;

  return {
    totalTokenCount,
    sections: sectionTotals.map((section) => ({
      ...section,
      share: totalTokenCount > 0 ? section.tokenCount / totalTokenCount : 0,
      bar:
        section.tokenCount === 0
          ? ""
          : "█".repeat(
              Math.max(
                1,
                Math.round((section.tokenCount / maxTokenCount) * maxBarWidth),
              ),
            ),
    })),
  };
}

export async function collectInspectReport(params: {
  config: CxConfig;
  tokenBreakdown?: boolean | undefined;
}): Promise<InspectReport> {
  const plan = await enrichPlanWithLinkedNotes(
    await buildBundlePlan(params.config),
    params.config,
  );
  const tokenBreakdown = params.tokenBreakdown
    ? await buildTokenBreakdown(plan, params.config.tokens.encoding)
    : undefined;
  let bundleComparison: InspectReport["bundleComparison"];
  let extractabilityByPath = new Map<string, InspectExtractability>();

  try {
    const { manifestName } = await validateBundle(plan.bundleDir);
    const { manifest } = await loadManifestFromBundle(plan.bundleDir);
    if (
      manifest.projectName !== plan.projectName ||
      manifest.sourceRoot !== plan.sourceRoot
    ) {
      bundleComparison = {
        available: false,
        bundleDir: plan.bundleDir,
        reason: "Existing bundle does not match the current plan.",
      };
    } else {
      const resolution = await resolveExtractability({
        bundleDir: plan.bundleDir,
        manifest,
        rows: manifest.files,
      });
      extractabilityByPath = new Map(
        resolution.records.map((record) => {
          const extractability: InspectExtractability = {
            status: record.status,
            reason: record.reason,
            message: record.message,
          };

          if (record.expectedSha256 !== undefined) {
            extractability.expectedSha256 = record.expectedSha256;
          }
          if (record.actualSha256 !== undefined) {
            extractability.actualSha256 = record.actualSha256;
          }

          return [record.path, extractability] as const;
        }),
      );
      bundleComparison = {
        available: true,
        bundleDir: plan.bundleDir,
        manifestName,
      };
    }
  } catch (error) {
    bundleComparison = {
      available: false,
      bundleDir: plan.bundleDir,
      reason: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    summary: buildInspectSummary(plan),
    bundleComparison,
    tokenBreakdown,
    sections: plan.sections.map((section) => ({
      name: section.name,
      style: section.style,
      outputFile: section.outputFile,
      files: section.files.map((file) => ({
        relativePath: file.relativePath,
        absolutePath: file.absolutePath,
        sizeBytes: file.sizeBytes,
        mediaType: file.mediaType,
        provenance: file.provenance,
        extractability: extractabilityByPath.get(file.relativePath) ?? null,
      })),
    })),
    assets: plan.assets.map((asset) => ({
      relativePath: asset.relativePath,
      absolutePath: asset.absolutePath,
      storedPath: asset.storedPath,
      sizeBytes: asset.sizeBytes,
      provenance: asset.provenance,
      extractability: extractabilityByPath.get(asset.relativePath) ?? null,
    })),
    unmatchedFiles: plan.unmatchedFiles,
    warnings: plan.warnings,
  };
}
