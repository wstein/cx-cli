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

interface SharedHandoverRenderParams {
  style: CxStyle;
  projectName: string;
  sectionOutputs: SharedHandoverSectionSummary[];
  assetPaths: Array<{ sourcePath: string; storedPath: string }>;
  provenanceSummary?: InclusionProvenanceSummary[] | undefined;
  repoHistory?: GitHistoryEntry[] | undefined;
}

function escapeXmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
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

function renderSharedHandoverXml(
  params: Omit<SharedHandoverRenderParams, "style">,
): string {
  const lines = [
    "<cx_shared_handover>",
    `  <project>${escapeXmlText(params.projectName)}</project>`,
    "  <purpose>shared handover companion for the rendered section outputs below.</purpose>",
    "  <sections>",
  ];

  for (const section of params.sectionOutputs) {
    lines.push("    <section>");
    lines.push(`      <name>${escapeXmlText(section.name)}</name>`);
    lines.push(`      <style>${section.style}</style>`);
    lines.push(
      `      <output_file>${escapeXmlText(section.outputFile)}</output_file>`,
    );
    lines.push(`      <file_count>${section.fileCount}</file_count>`);
    lines.push(`      <packed_tokens>${section.tokenCount}</packed_tokens>`);
    lines.push(
      `      <output_tokens>${section.outputTokenCount}</output_tokens>`,
    );
    lines.push("    </section>");
  }
  lines.push("  </sections>");

  if (params.assetPaths.length > 0) {
    lines.push("  <assets>");
    for (const asset of params.assetPaths) {
      lines.push("    <asset>");
      lines.push(
        `      <source_path>${escapeXmlText(asset.sourcePath)}</source_path>`,
      );
      lines.push(
        `      <stored_path>${escapeXmlText(asset.storedPath)}</stored_path>`,
      );
      lines.push("    </asset>");
    }
    lines.push("  </assets>");
  }

  if ((params.provenanceSummary?.length ?? 0) > 0) {
    lines.push("  <inclusion_provenance>");
    for (const entry of params.provenanceSummary ?? []) {
      lines.push("    <marker_summary>");
      lines.push(`      <marker>${escapeXmlText(entry.marker)}</marker>`);
      lines.push(`      <count>${entry.count}</count>`);
      lines.push("    </marker_summary>");
    }
    lines.push("  </inclusion_provenance>");
  }

  if ((params.repoHistory?.length ?? 0) > 0) {
    lines.push("  <recent_repository_history>");
    for (const entry of params.repoHistory ?? []) {
      lines.push("    <commit>");
      lines.push(`      <short_hash>${entry.shortHash}</short_hash>`);
      lines.push(`      <subject>${escapeXmlText(entry.subject)}</subject>`);
      lines.push("    </commit>");
    }
    lines.push("  </recent_repository_history>");
  }

  lines.push(
    "  <usage>use this shared handover with the section files; each section output remains self-contained.</usage>",
    "</cx_shared_handover>",
  );

  return `${lines.join("\n")}\n`;
}

function renderSharedHandoverJson(
  params: Omit<SharedHandoverRenderParams, "style">,
): string {
  return `${JSON.stringify(
    {
      kind: "cx_shared_handover",
      project: params.projectName,
      purpose:
        "shared handover companion for the rendered section outputs below.",
      sections: params.sectionOutputs.map((section) => ({
        name: section.name,
        style: section.style,
        outputFile: section.outputFile,
        fileCount: section.fileCount,
        packedTokens: section.tokenCount,
        outputTokens: section.outputTokenCount,
      })),
      ...(params.assetPaths.length > 0
        ? {
            assets: params.assetPaths.map((asset) => ({
              sourcePath: asset.sourcePath,
              storedPath: asset.storedPath,
            })),
          }
        : {}),
      ...((params.provenanceSummary?.length ?? 0) > 0
        ? {
            inclusionProvenance: (params.provenanceSummary ?? []).map(
              (entry) => ({
                marker: entry.marker,
                count: entry.count,
              }),
            ),
          }
        : {}),
      ...((params.repoHistory?.length ?? 0) > 0
        ? {
            recentRepositoryHistory: (params.repoHistory ?? []).map(
              (entry) => ({
                shortHash: entry.shortHash,
                subject: entry.subject,
              }),
            ),
          }
        : {}),
      usage:
        "use this shared handover with the section files; each section output remains self-contained.",
    },
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
      lines.push(`- ${entry.shortHash} ${entry.subject}`);
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
