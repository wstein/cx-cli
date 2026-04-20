import type { RenderFileSpan, StructuredRenderPlan } from "../types.js";
import {
  buildDirectoryStructureText,
  buildXmlSummaryText,
  normalizedLogicalLineCount,
} from "./common.js";

export function renderNativeXmlSection(params: {
  plan: StructuredRenderPlan;
  headerText: string;
  securityCheck: boolean;
}): { outputText: string; fileSpans: Map<string, RenderFileSpan> } {
  const fileSpans = new Map<string, RenderFileSpan>();
  let output = buildXmlSummaryText(params.securityCheck);
  output += `<user_provided_header>\n${params.headerText}\n</user_provided_header>\n\n`;
  output += `<directory_structure>\n${buildDirectoryStructureText(params.plan.ordering)}\n</directory_structure>\n\n`;
  output += `<files>\nThis section contains the contents of the repository's files.\n\n`;

  for (const [index, entry] of params.plan.entries.entries()) {
    output += `<file path="${entry.path}">\n`;
    const outputStartLine = output.split("\n").length;
    output += `${entry.content}\n</file>`;
    const lineCount = normalizedLogicalLineCount(entry.content);
    fileSpans.set(entry.path, {
      outputStartLine,
      outputEndLine: outputStartLine + lineCount - 1,
    });
    output += index === params.plan.entries.length - 1 ? "\n\n" : "\n\n";
  }

  output += `</files>\n`;
  return { outputText: output, fileSpans };
}
