export type StabilityTier = "STABLE" | "BETA" | "EXPERIMENTAL" | "INTERNAL";

export const TOOL_TIERS: Record<string, StabilityTier> = {
  // Workspace (read capability)
  list: "STABLE",
  grep: "STABLE",
  read: "STABLE",
  replace_repomix_span: "BETA",

  // Planning (plan capability)
  inspect: "STABLE",
  bundle: "STABLE",

  // Doctor (observe capability)
  doctor_mcp: "BETA",
  doctor_workflow: "BETA",
  doctor_overlaps: "BETA",
  doctor_secrets: "BETA",

  // Notes lifecycle (mutate/observe capability)
  notes_new: "STABLE",
  notes_read: "STABLE",
  notes_update: "STABLE",
  notes_delete: "STABLE",
  notes_rename: "STABLE",

  // Notes discovery (observe capability)
  notes_search: "STABLE",
  notes_list: "STABLE",

  // Notes graph analysis (observe capability)
  notes_backlinks: "STABLE",
  notes_orphans: "STABLE",
  notes_code_links: "STABLE",
  notes_links: "STABLE",
};

export function tierLabel(tool: string): string {
  return `[${TOOL_TIERS[tool] ?? "INTERNAL"}]`;
}
