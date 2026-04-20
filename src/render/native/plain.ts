import type { RenderFileSpan, StructuredRenderPlan } from "../types.js";
import {
  buildDirectoryStructureText,
  buildPlainBlockHeading,
  buildPlainSummaryText,
  normalizedLogicalLineCount,
  PLAIN_LONG_SEPARATOR,
  PLAIN_SHORT_SEPARATOR,
} from "./common.js";

export function renderNativePlainSection(params: {
  plan: StructuredRenderPlan;
  headerText: string;
}): { outputText: string; fileSpans: Map<string, RenderFileSpan> } {
  const fileSpans = new Map<string, RenderFileSpan>();
  const lines = [
    buildPlainSummaryText(),
    buildPlainBlockHeading("User Provided Header"),
    params.headerText,
    "",
    buildPlainBlockHeading("Directory Structure"),
    buildDirectoryStructureText(params.plan.ordering),
    "",
    buildPlainBlockHeading("Files"),
    "",
  ];

  let currentLine = lines.join("\n").split("\n").length + 1;

  for (const [index, entry] of params.plan.entries.entries()) {
    lines.push(
      PLAIN_SHORT_SEPARATOR,
      `File: ${entry.path}`,
      PLAIN_SHORT_SEPARATOR,
    );
    const outputStartLine = currentLine + 3;
    const contentLines =
      entry.content === "" ? [""] : entry.content.split("\n");
    lines.push(...contentLines);
    const lineCount = normalizedLogicalLineCount(entry.content);
    fileSpans.set(entry.path, {
      outputStartLine,
      outputEndLine: outputStartLine + lineCount - 1,
    });

    if (index === params.plan.entries.length - 1) {
      lines.push("", "", "", "", "");
      currentLine += 3 + contentLines.length + 5;
    } else {
      lines.push("");
      currentLine += 3 + contentLines.length + 1;
    }
  }

  lines.push(PLAIN_LONG_SEPARATOR, "End of Codebase", PLAIN_LONG_SEPARATOR, "");

  return {
    outputText: lines.join("\n"),
    fileSpans,
  };
}
