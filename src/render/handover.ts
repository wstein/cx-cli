import type { CxStyle } from "../config/types.js";
import type { InclusionProvenanceSummary } from "../planning/provenance.js";
import type { GitHistoryEntry } from "../vcs/git.js";

export interface SharedHandoverSectionSummary {
  name: string;
  style: CxStyle;
  outputFile: string;
  fileCount: number;
  tokenCount: number;
  outputTokenCount: number;
}

export function renderSharedHandoverText(params: {
  projectName: string;
  sectionOutputs: SharedHandoverSectionSummary[];
  assetPaths: Array<{ sourcePath: string; storedPath: string }>;
  provenanceSummary?: InclusionProvenanceSummary[] | undefined;
  repoHistory?: GitHistoryEntry[] | undefined;
}): string {
  const lines = [
    "cx shared handover",
    `project: ${params.projectName}`,
    "purpose: shared handover companion for the rendered section outputs below.",
    "",
    "sections:",
  ];

  for (const section of params.sectionOutputs) {
    lines.push(
      `- ${section.name}: ${section.outputFile} | ${section.style} | ${section.fileCount} files | packed tokens ${section.tokenCount} | output tokens ${section.outputTokenCount}`,
    );
  }

  if (params.assetPaths.length > 0) {
    lines.push("", "assets:");
    for (const asset of params.assetPaths) {
      lines.push(`- ${asset.sourcePath} -> ${asset.storedPath}`);
    }
  }

  if ((params.provenanceSummary?.length ?? 0) > 0) {
    lines.push("", "inclusion provenance:");
    for (const entry of params.provenanceSummary ?? []) {
      lines.push(
        `- ${entry.marker}: ${entry.count} path${entry.count === 1 ? "" : "s"}`,
      );
    }
  }

  if ((params.repoHistory?.length ?? 0) > 0) {
    lines.push("", "recent repository history:");
    for (const entry of params.repoHistory ?? []) {
      lines.push(`- ${entry.shortHash} ${entry.subject}`);
    }
  }

  lines.push(
    "",
    "use this shared handover with the section files; each section output remains self-contained.",
  );

  return `${lines.join("\n")}\n`;
}
