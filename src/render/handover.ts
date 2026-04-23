import type { CxStyle } from "../config/types.js";
import type { InclusionProvenanceSummary } from "../planning/provenance.js";
import { buildJsonSharedHandover } from "./jsonArtifacts.js";

export interface SharedHandoverSectionSummary {
  name: string;
  style: CxStyle;
  outputFile: string;
  fileCount: number;
  tokenCount: number;
  outputTokenCount: number;
}

export interface RepositoryHistoryEntry {
  shortHash: string;
  message: string;
}

export interface SharedHandoverDerivedReviewExportSummary {
  assemblyName: string;
  storedPath: string;
  moduleName: string | null;
  pageCount: number;
  rootLevel: 0 | 1;
}

function appendHistoryLines(
  lines: string[],
  entry: RepositoryHistoryEntry,
): void {
  lines.push(`- ${entry.shortHash}`);
  for (const line of entry.message.replace(/\n+$/u, "").split("\n")) {
    lines.push(line.length === 0 ? "  " : `  ${line}`);
  }
}

interface SharedHandoverRenderParams {
  style: CxStyle;
  projectName: string;
  sectionOutputs: SharedHandoverSectionSummary[];
  assetPaths: Array<{ sourcePath: string; storedPath: string }>;
  derivedReviewExports?: SharedHandoverDerivedReviewExportSummary[] | undefined;
  provenanceSummary?: InclusionProvenanceSummary[] | undefined;
  repoHistory?: RepositoryHistoryEntry[] | undefined;
}

function renderSharedHandoverPlainText(
  params: Omit<SharedHandoverRenderParams, "style">,
): string {
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

  if ((params.derivedReviewExports?.length ?? 0) > 0) {
    lines.push("", "derived review exports:");
    for (const artifact of params.derivedReviewExports ?? []) {
      lines.push(
        `- ${artifact.assemblyName}: ${artifact.storedPath} | module ${artifact.moduleName ?? "none"} | ${artifact.pageCount} pages | root level ${artifact.rootLevel}`,
      );
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
      appendHistoryLines(lines, entry);
    }
  }

  lines.push(
    "",
    "use this shared handover with the section files; each section output remains self-contained.",
  );

  return `${lines.join("\n")}\n`;
}

function renderSharedHandoverXml(
  params: Omit<SharedHandoverRenderParams, "style">,
): string {
  const lines = [
    "cx shared handover",
    `project: ${params.projectName}`,
    "purpose: shared handover companion for the rendered section outputs below.",
    "",
    "<section_inventory>",
  ];

  for (const section of params.sectionOutputs) {
    lines.push(
      `- ${section.name}: ${section.outputFile} | ${section.style} | ${section.fileCount} files | packed tokens ${section.tokenCount} | output tokens ${section.outputTokenCount}`,
    );
  }
  lines.push("</section_inventory>");

  if (params.assetPaths.length > 0) {
    lines.push("", "<asset_inventory>");
    for (const asset of params.assetPaths) {
      lines.push(`- ${asset.sourcePath} -> ${asset.storedPath}`);
    }
    lines.push("</asset_inventory>");
  }

  if ((params.derivedReviewExports?.length ?? 0) > 0) {
    lines.push("", "<derived_review_export_inventory>");
    for (const artifact of params.derivedReviewExports ?? []) {
      lines.push(
        `- ${artifact.assemblyName}: ${artifact.storedPath} | module ${artifact.moduleName ?? "none"} | ${artifact.pageCount} pages | root level ${artifact.rootLevel}`,
      );
    }
    lines.push("</derived_review_export_inventory>");
  }

  if ((params.provenanceSummary?.length ?? 0) > 0) {
    lines.push("", "<inclusion_provenance>");
    for (const entry of params.provenanceSummary ?? []) {
      lines.push(
        `- ${entry.marker}: ${entry.count} path${entry.count === 1 ? "" : "s"}`,
      );
    }
    lines.push("</inclusion_provenance>");
  }

  if ((params.repoHistory?.length ?? 0) > 0) {
    lines.push("", "<recent_repository_history>");
    for (const entry of params.repoHistory ?? []) {
      appendHistoryLines(lines, entry);
    }
    lines.push("</recent_repository_history>");
  }

  lines.push(
    "",
    "<usage>",
    "use this shared handover with the section files; each section output remains self-contained.",
    "</usage>",
  );

  return `${lines.join("\n")}\n`;
}

function renderSharedHandoverJson(
  params: Omit<SharedHandoverRenderParams, "style">,
): string {
  return `${JSON.stringify(
    buildJsonSharedHandover({
      projectName: params.projectName,
      sectionOutputs: params.sectionOutputs,
      assetPaths: params.assetPaths,
      derivedReviewExports: params.derivedReviewExports,
      provenanceSummary: params.provenanceSummary,
      repoHistory: params.repoHistory,
    }),
    null,
    2,
  )}\n`;
}

function renderSharedHandoverMarkdown(
  params: Omit<SharedHandoverRenderParams, "style">,
): string {
  const lines = [
    "# cx shared handover",
    "",
    `project: ${params.projectName}`,
    "purpose: shared handover companion for the rendered section outputs below.",
    "",
    "## Sections",
  ];

  for (const section of params.sectionOutputs) {
    lines.push(
      `- ${section.name}: ${section.outputFile} | ${section.style} | ${section.fileCount} files | packed tokens ${section.tokenCount} | output tokens ${section.outputTokenCount}`,
    );
  }

  if (params.assetPaths.length > 0) {
    lines.push("", "## Assets");
    for (const asset of params.assetPaths) {
      lines.push(`- ${asset.sourcePath} -> ${asset.storedPath}`);
    }
  }

  if ((params.derivedReviewExports?.length ?? 0) > 0) {
    lines.push("", "## Derived review exports");
    for (const artifact of params.derivedReviewExports ?? []) {
      lines.push(
        `- ${artifact.assemblyName}: ${artifact.storedPath} | module ${artifact.moduleName ?? "none"} | ${artifact.pageCount} pages | root level ${artifact.rootLevel}`,
      );
    }
  }

  if ((params.provenanceSummary?.length ?? 0) > 0) {
    lines.push("", "## Inclusion provenance");
    for (const entry of params.provenanceSummary ?? []) {
      lines.push(
        `- ${entry.marker}: ${entry.count} path${entry.count === 1 ? "" : "s"}`,
      );
    }
  }

  if ((params.repoHistory?.length ?? 0) > 0) {
    lines.push("", "## Recent repository history");
    for (const entry of params.repoHistory ?? []) {
      appendHistoryLines(lines, entry);
    }
  }

  lines.push(
    "",
    "use this shared handover with the section files; each section output remains self-contained.",
  );

  return `${lines.join("\n")}\n`;
}

export function renderSharedHandover(
  params: SharedHandoverRenderParams,
): string {
  const { style, ...shared } = params;

  switch (style) {
    case "xml":
      return renderSharedHandoverXml(shared);
    case "json":
      return renderSharedHandoverJson(shared);
    case "markdown":
      return renderSharedHandoverMarkdown(shared);
    case "plain":
      return renderSharedHandoverPlainText(shared);
  }
}
