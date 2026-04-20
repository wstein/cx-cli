import type { RenderFileSpan, StructuredRenderPlan } from "../types.js";
import { buildJsonSummary } from "./common.js";

export function renderNativeJsonSection(params: {
  plan: StructuredRenderPlan;
  headerText: string;
}): { outputText: string; fileSpans: Map<string, RenderFileSpan> } {
  const summary = buildJsonSummary(params.headerText, params.plan.ordering);
  const files: Record<string, string> = {};

  for (const entry of params.plan.entries) {
    files[entry.path] = entry.content;
  }

  return {
    outputText: JSON.stringify(
      {
        ...summary,
        files,
      },
      null,
      2,
    ),
    fileSpans: new Map(),
  };
}
