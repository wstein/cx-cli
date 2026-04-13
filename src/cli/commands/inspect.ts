import {
  loadManifestFromBundle,
  validateBundle,
} from "../../bundle/validate.js";
import { getCLIOverrides, readEnvOverrides } from "../../config/env.js";
import { loadCxConfig } from "../../config/load.js";
import type { CxAssetsLayout } from "../../config/types.js";
import { resolveExtractability } from "../../extract/resolution.js";
import { buildBundlePlan } from "../../planning/buildPlan.js";
import { getRepomixCapabilities } from "../../repomix/render.js";
import { formatNumber } from "../../shared/format.js";
import { writeJson } from "../../shared/output.js";
import { countTokensForFiles } from "../../shared/tokens.js";

export interface InspectArgs {
  config: string;
  json: boolean;
  tokenBreakdown?: boolean;
  layout?: CxAssetsLayout | undefined;
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

function formatChecksumPrefix(checksum: string | undefined): string {
  return checksum ? `${checksum.slice(0, 8)}…` : "unknown";
}

function buildInspectSummary(
  plan: Awaited<ReturnType<typeof buildBundlePlan>>,
) {
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

function renderTokenBreakdown(breakdown: TokenBreakdown): string {
  const nameWidth = Math.max(
    6,
    ...breakdown.sections.map((section) => section.name.length),
  );
  const barWidth = 24;
  const lines = ["", "Token breakdown", "  SECTION  TOKENS   SHARE   GRAPH"];

  for (const section of breakdown.sections) {
    const share = breakdown.totalTokenCount > 0 ? section.share * 100 : 0;
    lines.push(
      `  ${section.name.padEnd(nameWidth)}  ${formatNumber(section.tokenCount).padStart(6)}  ${share.toFixed(1).padStart(5)}%  ${section.bar.padEnd(barWidth)}`,
    );
  }

  lines.push(
    `  ${"Total".padEnd(nameWidth)}  ${formatNumber(breakdown.totalTokenCount).padStart(6)}  100.0%  ${"█".repeat(barWidth)}`,
  );
  return lines.join("\n");
}

export async function runInspectCommand(args: InspectArgs): Promise<number> {
  const config = await loadCxConfig(
    args.config ?? "cx.toml",
    readEnvOverrides(),
    {
      ...getCLIOverrides(),
      ...(args.layout !== undefined && { assetsLayout: args.layout }),
    },
  );
  const plan = await buildBundlePlan(config);
  const tokenBreakdown = args.tokenBreakdown
    ? await buildTokenBreakdown(plan, config.tokens.encoding)
    : undefined;
  let bundleComparison:
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
  let extractabilityByPath = new Map<
    string,
    {
      status: string;
      reason: string;
      message: string;
      expectedSha256?: string;
      actualSha256?: string;
    }
  >();

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
          const extractability = {
            status: record.status,
            reason: record.reason,
            message: record.message,
          } as {
            status: string;
            reason: string;
            message: string;
            expectedSha256?: string;
            actualSha256?: string;
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

  if (args.json) {
    writeJson({
      summary: buildInspectSummary(plan),
      repomix: await getRepomixCapabilities(),
      bundleComparison,
      tokenBreakdown,
      sections: plan.sections.map((section) => ({
        ...section,
        files: section.files.map((file) => ({
          ...file,
          extractability: extractabilityByPath.get(file.relativePath) ?? null,
        })),
      })),
      assets: plan.assets.map((asset) => ({
        ...asset,
        extractability: extractabilityByPath.get(asset.relativePath) ?? null,
      })),
      unmatchedFiles: plan.unmatchedFiles,
      warnings: plan.warnings,
    });
    return 0;
  }

  const lines = [
    `project: ${plan.projectName}`,
    `source_root: ${plan.sourceRoot}`,
    `bundle_dir: ${plan.bundleDir}`,
    bundleComparison.available
      ? `bundle_status: available (${bundleComparison.manifestName})`
      : `bundle_status: unavailable (${bundleComparison.reason})`,
    `sections: ${plan.sections.length}`,
    `assets: ${plan.assets.length}`,
    `unmatched: ${plan.unmatchedFiles.length}`,
    "",
    ...plan.sections.flatMap((section) => [
      `section ${section.name} (${section.style}) -> ${section.outputFile} [${section.files.length} files]`,
      ...section.files.map((file) => {
        const record = extractabilityByPath.get(file.relativePath);
        const suffix =
          record && record.status !== "intact"
            ? ` (${record.reason}; expected ${formatChecksumPrefix(record.expectedSha256)} got ${formatChecksumPrefix(record.actualSha256)})`
            : "";
        const status = (record?.status ?? "unknown").padEnd(8);
        return `  ${status} ${file.relativePath}${suffix}`;
      }),
      "",
    ]),
    ...(plan.assets.length > 0
      ? [
          "assets",
          ...plan.assets.map((asset) => {
            const record = extractabilityByPath.get(asset.relativePath);
            const status = (record?.status ?? "planned").padEnd(8);
            return `  ${status} ${asset.relativePath} -> ${asset.storedPath}`;
          }),
          "",
        ]
      : []),
    ...(plan.unmatchedFiles.length > 0
      ? ["unmatched", ...plan.unmatchedFiles.map((file) => `  ${file}`)]
      : []),
  ];

  process.stdout.write(
    `${lines.join("\n").trimEnd()}${tokenBreakdown ? renderTokenBreakdown(tokenBreakdown) : ""}\n`,
  );
  return 0;
}
