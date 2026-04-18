import { getCLIOverrides, readEnvOverrides } from "../../config/env.js";
import { loadCxConfig } from "../../config/load.js";
import type { CxAssetsLayout } from "../../config/types.js";
import {
  collectInspectReport,
  type InspectExtractability,
  type InspectReport,
} from "../../inspect/report.js";
import { formatNumber } from "../../shared/format.js";
import { writeJson } from "../../shared/output.js";

export type { InspectReport } from "../../inspect/report.js";
export { collectInspectReport } from "../../inspect/report.js";

export interface InspectArgs {
  config: string;
  json: boolean;
  tokenBreakdown?: boolean;
  layout?: CxAssetsLayout | undefined;
}

function formatChecksumPrefix(checksum: string | undefined): string {
  return checksum ? `${checksum.slice(0, 8)}…` : "unknown";
}

function renderTokenBreakdown(
  breakdown: NonNullable<InspectReport["tokenBreakdown"]>,
): string {
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
  const report = await collectInspectReport({
    config,
    ...(args.tokenBreakdown !== undefined
      ? { tokenBreakdown: args.tokenBreakdown }
      : {}),
  });

  if (args.json) {
    writeJson(report);
    return 0;
  }

  const plan = report.summary;
  const bundleComparison = report.bundleComparison;
  const extractabilityByPath = new Map<string, InspectExtractability | null>();
  for (const section of report.sections) {
    for (const file of section.files) {
      extractabilityByPath.set(file.relativePath, file.extractability);
    }
  }
  for (const asset of report.assets) {
    extractabilityByPath.set(asset.relativePath, asset.extractability);
  }

  const lines = [
    `project: ${plan.projectName}`,
    `source_root: ${plan.sourceRoot}`,
    `bundle_dir: ${plan.bundleDir}`,
    "workflow: static snapshot planning for verified bundle artifacts",
    "mcp: use cx mcp for live workspace exploration and note updates",
    bundleComparison.available
      ? `bundle_status: available (${bundleComparison.manifestName})`
      : `bundle_status: unavailable (${bundleComparison.reason})`,
    `sections: ${plan.sectionCount}`,
    `assets: ${plan.assetCount}`,
    `unmatched: ${plan.unmatchedCount}`,
    "",
    ...report.sections.flatMap((section) => [
      `section ${section.name} (${section.style}) -> ${section.outputFile} [${section.files.length} files]`,
      ...section.files.map((file) => {
        const record = extractabilityByPath.get(file.relativePath);
        const provenanceSuffix =
          file.provenance.length > 0 ? ` [${file.provenance.join(", ")}]` : "";
        const suffix =
          record && record.status !== "intact"
            ? ` (${record.reason}; expected ${formatChecksumPrefix(record.expectedSha256)} got ${formatChecksumPrefix(record.actualSha256)})`
            : "";
        const status = (record?.status ?? "unknown").padEnd(8);
        return `  ${status} ${file.relativePath}${provenanceSuffix}${suffix}`;
      }),
      "",
    ]),
    ...(report.assets.length > 0
      ? [
          "assets",
          ...report.assets.map((asset) => {
            const record = extractabilityByPath.get(asset.relativePath);
            const status = (record?.status ?? "planned").padEnd(8);
            const provenanceSuffix =
              asset.provenance.length > 0
                ? ` [${asset.provenance.join(", ")}]`
                : "";
            return `  ${status} ${asset.relativePath} -> ${asset.storedPath}${provenanceSuffix}`;
          }),
          "",
        ]
      : []),
    ...(report.unmatchedFiles.length > 0
      ? ["unmatched", ...report.unmatchedFiles.map((file) => `  ${file}`)]
      : []),
  ];

  process.stdout.write(
    `${lines.join("\n").trimEnd()}${report.tokenBreakdown ? renderTokenBreakdown(report.tokenBreakdown) : ""}\n`,
  );
  return 0;
}
