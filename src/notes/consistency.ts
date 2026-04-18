import path from "node:path";

import { CX_MCP_TOOL_NAMES } from "../mcp/tools/catalog.js";
import { buildNoteGraph } from "./graph.js";
import { validateNotes } from "./validate.js";

export interface ConsistencyReport {
  duplicateIds: Array<{ id: string; files: string[] }>;
  brokenLinks: Array<{
    fromNoteId: string;
    fromTitle: string;
    reference: string;
    source: "note" | "code";
  }>;
  orphans: Array<{ id: string; title: string }>;
  totalNotes: number;
  valid: boolean;
}

export async function checkNotesConsistency(
  notesDir = "notes",
  projectRoot = process.cwd(),
): Promise<ConsistencyReport> {
  const validation = await validateNotes(notesDir, projectRoot);
  const graph = await buildNoteGraph(notesDir, projectRoot);

  const orphanDetails = graph.orphans.map((id) => {
    const note = graph.notes.get(id);
    return {
      id,
      title: note?.title ?? "Unknown",
    };
  });

  const brokenLinksFormatted = graph.brokenLinks.map((issue) => ({
    fromNoteId: issue.fromNoteId,
    fromTitle: issue.fromTitle,
    reference: issue.reference,
    source: issue.source,
  }));

  const valid =
    validation.errors.length === 0 &&
    validation.duplicateIds.length === 0 &&
    graph.brokenLinks.length === 0;

  return {
    duplicateIds: validation.duplicateIds,
    brokenLinks: brokenLinksFormatted,
    orphans: orphanDetails,
    totalNotes: validation.notes.length,
    valid,
  };
}

export async function checkNoteCoverage(
  notesDir = "notes",
  projectRoot = process.cwd(),
): Promise<{
  totalTools: number;
  documentedTools: number;
  undocumentedTools: string[];
  percentage: number;
}> {
  const graph = await buildNoteGraph(notesDir, projectRoot);
  const toolNames = [...CX_MCP_TOOL_NAMES];

  const documented = new Set<string>();
  for (const link of graph.links) {
    if (link.type === "code-reference") {
      const filename = path.basename(link.fromNoteId);
      for (const toolName of toolNames) {
        if (
          filename.includes(toolName) ||
          filename.includes(toolName.replaceAll("_", "-"))
        ) {
          documented.add(toolName);
        }
      }
    }
  }

  const undocumentedTools = toolNames.filter((tool) => !documented.has(tool));
  const percentage =
    toolNames.length > 0 ? (documented.size / toolNames.length) * 100 : 0;

  return {
    totalTools: toolNames.length,
    documentedTools: documented.size,
    undocumentedTools,
    percentage: Math.round(percentage),
  };
}
