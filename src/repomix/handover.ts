import type { CxStyle } from "../config/types.js";

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
    "shared context: keep this file together with the bundle index when handing off multiple sections.",
  );

  return lines.join("\n");
}

export function buildBundleIndexText(params: {
  projectName: string;
  sectionOutputs: SectionHandoverSummary[];
  assetPaths: Array<{ sourcePath: string; storedPath: string }>;
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

  lines.push(
    "",
    "use this index with the section files; each section output remains self-contained.",
  );

  return `${lines.join("\n")}\n`;
}
