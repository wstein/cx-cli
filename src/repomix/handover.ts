import type { CxStyle } from "../config/types.js";
import type { InclusionProvenanceSummary } from "../planning/provenance.js";

export interface SectionHandoverSummary {
  name: string;
  style: CxStyle;
  outputFile: string;
  fileCount: number;
  tokenCount: number;
  outputTokenCount: number;
}

export function buildSectionHeaderText(params: {
  projectName: string;
  sectionName: string;
  outputFile?: string;
  fileCount: number;
  style: CxStyle;
  bundleIndexFile?: string;
}): string {
  const lines = [
    "cx section handover",
    "artifact: deterministic section snapshot for human and AI review.",
    `project: ${params.projectName}`,
    `section: ${params.sectionName}`,
    `style: ${params.style}`,
    `files: ${params.fileCount}`,
  ];

  if (params.outputFile) {
    lines.push(`output: ${params.outputFile}`);
  }

  if (params.bundleIndexFile) {
    lines.push(`bundle index: ${params.bundleIndexFile}`);
  }

  lines.push(
    "usage: review and cite the logical paths in this snapshot, but make repository edits in the original source tree.",
    "path semantics: each logical path points to the original repository location for that file.",
    "authoritative semantics: cx-meta, cx-policy, archive markers, manifests, and validation rules remain canonical.",
    "shared context: keep this file together with the bundle index when handing off multiple sections.",
  );

  return lines.join("\n");
}

export function buildBundleIndexText(params: {
  projectName: string;
  sectionOutputs: SectionHandoverSummary[];
  assetPaths: Array<{ sourcePath: string; storedPath: string }>;
  provenanceSummary?: InclusionProvenanceSummary[] | undefined;
}): string {
  const lines = [
    "cx bundle index",
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

  lines.push(
    "",
    "use this index with the section files; each section output remains self-contained.",
  );

  return `${lines.join("\n")}\n`;
}
