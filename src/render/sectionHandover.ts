import type { CxStyle } from "../config/types.js";

export function buildSectionHandoverText(params: {
  projectName: string;
  sectionName: string;
  outputFile?: string;
  fileCount: number;
  style: CxStyle;
  handoverFile?: string;
}): string {
  const lines = [
    "cx section handover",
    "artifact: deterministic section snapshot for human and AI review.",
    "",
    "<section_identity>",
    `project: ${params.projectName}`,
    `section: ${params.sectionName}`,
    `style: ${params.style}`,
    `files: ${params.fileCount}`,
  ];

  if (params.outputFile) {
    lines.push(`output: ${params.outputFile}`);
  }

  if (params.handoverFile) {
    lines.push(`shared handover: ${params.handoverFile}`);
  }

  lines.push("</section_identity>");

  lines.push(
    "",
    "<usage>",
    "review and cite the logical paths in this snapshot, but make repository edits in the original source tree.",
    "</usage>",
    "",
    "<path_semantics>",
    "each logical path points to the original repository location for that file.",
    "</path_semantics>",
    "",
    "<authoritative_semantics>",
    "cx-meta, cx-policy, archive markers, manifests, and validation rules remain canonical.",
    "</authoritative_semantics>",
    "",
    "<shared_context>",
    "keep this file together with the shared handover when handing off multiple sections.",
    "</shared_context>",
  );

  return lines.join("\n");
}
