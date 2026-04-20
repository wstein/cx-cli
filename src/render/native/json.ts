import { JsonSectionOutputSchema } from "../jsonArtifacts.js";
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

  const payload = JsonSectionOutputSchema.parse({
    ...summary,
    files,
  });

  return {
    outputText: JSON.stringify(payload, null, 2),
    fileSpans: new Map(),
  };
}
