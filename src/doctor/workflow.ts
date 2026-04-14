export interface WorkflowRecommendation {
  mode: "bundle" | "inspect" | "mcp";
  sequence: Array<"bundle" | "inspect" | "mcp">;
  reason: string;
  signals: string[];
}

export function recommendWorkflow(task: string): WorkflowRecommendation {
  const normalized = task.toLowerCase();
  const signals: string[] = [];

  const recordSignals = (
    candidates: Array<[string, boolean]>,
  ): boolean => {
    let matched = false;
    for (const [label, hit] of candidates) {
      if (hit) {
        signals.push(label);
        matched = true;
      }
    }
    return matched;
  };

  const bundleMatch = recordSignals([
    ["bundle", /\b(bundle|snapshot|verify|checksum|manifest|handoff|ci)\b/.test(normalized)],
    ["immutable review", /\b(review|approve|release|audit)\b/.test(normalized)],
  ]);
  const inspectMatch = recordSignals([
    ["inspect", /\b(inspect|preview|plan|token budget|token breakdown)\b/.test(normalized)],
    ["compare", /\b(compare|diff|drift)\b/.test(normalized)],
  ]);
  const mcpMatch = recordSignals([
    ["mcp", /\b(mcp|explore|search|read|update|note|notes|agent|investigate)\b/.test(normalized)],
  ]);

  if ((inspectMatch || bundleMatch) && mcpMatch) {
    return {
      mode: "inspect",
      sequence: ["inspect", "bundle", "mcp"],
      reason:
        "The task spans planning and live note work, so inspect first, bundle the handoff snapshot next, and use MCP last against the live workspace.",
      signals,
    };
  }

  if (bundleMatch) {
    return {
      mode: "bundle",
      sequence: ["bundle"],
      reason:
        "The task is about a verified snapshot, review, or handoff, so a static bundle is the safest boundary.",
      signals,
    };
  }

  if (inspectMatch) {
    return {
      mode: "inspect",
      sequence: ["inspect"],
      reason:
        "The task needs planning or comparison before writing, so cx inspect is the right middle step.",
      signals,
    };
  }

  return {
    mode: "mcp",
    sequence: ["mcp"],
    reason:
      "The task is interactive or exploratory, so a live MCP workspace is the best fit.",
    signals,
  };
}
