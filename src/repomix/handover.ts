import type { CxStyle } from "../config/types.js";

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
    "shared context: keep this file together with the shared handover when handing off multiple sections.",
  );

  return lines.join("\n");
}
