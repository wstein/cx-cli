import type { RenderFileSpan, StructuredRenderPlan } from "../types.js";
import * as common from "./common.js";

export function renderNativeMarkdownSection(params: {
  plan: StructuredRenderPlan;
  headerText: string;
  securityCheck: boolean;
}): { outputText: string; fileSpans: Map<string, RenderFileSpan> } {
  const fileSpans = new Map<string, RenderFileSpan>();
  let output = common.buildMarkdownSummaryText(params.securityCheck);
  output += `# User Provided Header\n${params.headerText}\n\n`;
  output += `# Directory Structure\n\`\`\`\n${common.buildDirectoryStructureText(
    params.plan.ordering,
  )}\n\`\`\`\n\n`;
  output += `# Files\n\n`;

  for (const [index, entry] of params.plan.entries.entries()) {
    const block = common.renderMarkdownFileBlock(entry);
    const headingPrefix = `## File: ${entry.path}\n`;
    const fenceLineEnd = block.indexOf("\n", headingPrefix.length);
    const outputStartLine =
      output.split("\n").length +
      block.slice(0, fenceLineEnd + 1).split("\n").length -
      1;
    const lineCount = common.normalizedLogicalLineCount(entry.content);
    fileSpans.set(entry.path, {
      outputStartLine,
      outputEndLine: outputStartLine + lineCount - 1,
    });
    output += block;
    output += index === params.plan.entries.length - 1 ? "\n" : "\n\n";
  }

  return { outputText: output, fileSpans };
}
