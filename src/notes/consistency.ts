import fs from "node:fs/promises";
import path from "node:path";

import { CX_MCP_TOOL_NAMES } from "../mcp/tools/catalog.js";
import { pathExists } from "../shared/fs.js";
import { getVCSState } from "../vcs/provider.js";
import { buildNoteGraph } from "./graph.js";
import {
  extractWikilinkReferences,
  normalizeWikilinkReference,
  resolveWikilinkReference,
} from "./linking.js";
import { validateNotes } from "./validate.js";

export interface NoteCodePathWarning {
  fromNoteId: string;
  fromTitle: string;
  reference: string;
  path: string;
  status: "missing" | "outside_master_list";
}

export interface ConsistencyReport {
  duplicateIds: Array<{ id: string; files: string[] }>;
  brokenLinks: Array<{
    fromNoteId: string;
    fromTitle: string;
    reference: string;
    source: "note" | "code";
  }>;
  codePathWarnings: NoteCodePathWarning[];
  orphans: Array<{ id: string; title: string }>;
  totalNotes: number;
  valid: boolean;
}

function looksLikeRepositoryPath(reference: string): boolean {
  return /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*\.[A-Za-z0-9._-]+$/u.test(
    reference,
  );
}

export async function collectNoteCodePathWarnings(
  notes: Awaited<ReturnType<typeof validateNotes>>["notes"],
  projectRoot: string,
  repositoryPaths?: Iterable<string>,
): Promise<NoteCodePathWarning[]> {
  const notesMap = new Map(notes.map((note) => [note.id, note]));
  const knownRepositoryPaths =
    repositoryPaths === undefined
      ? new Set(
          (await getVCSState(projectRoot)).trackedFiles.map((filePath) =>
            filePath.replaceAll("\\", "/"),
          ),
        )
      : new Set(
          [...repositoryPaths].map((filePath) => filePath.replaceAll("\\", "/")),
        );
  const warnings = new Map<string, NoteCodePathWarning>();

  for (const note of notes) {
    let content: string;
    try {
      content = await fs.readFile(note.filePath, "utf8");
    } catch {
      continue;
    }

    for (const reference of extractWikilinkReferences(content)) {
      const normalized = normalizeWikilinkReference(reference.raw);
      if (resolveWikilinkReference(normalized, notesMap) !== null) {
        continue;
      }

      const normalizedPath = normalized.replace(/^\.\/+/u, "");
      if (!looksLikeRepositoryPath(normalizedPath)) {
        continue;
      }

      const status = knownRepositoryPaths.has(normalizedPath)
        ? null
        : (await pathExists(path.join(projectRoot, normalizedPath)))
          ? "outside_master_list"
          : "missing";
      if (status === null) {
        continue;
      }

      warnings.set(`${note.id}:${normalizedPath}`, {
        fromNoteId: note.id,
        fromTitle: note.title,
        reference: reference.raw,
        path: normalizedPath,
        status,
      });
    }
  }

  return [...warnings.values()];
}

export async function checkNotesConsistency(
  notesDir = "notes",
  projectRoot = process.cwd(),
): Promise<ConsistencyReport> {
  const validation = await validateNotes(notesDir, projectRoot);
  const graph = await buildNoteGraph(notesDir, projectRoot);
  const codePathWarnings = await collectNoteCodePathWarnings(
    validation.notes,
    projectRoot,
  );

  const orphanDetails = graph.orphans.map((id) => {
    const note = graph.notes.get(id);
    return {
      id,
      title: note?.title ?? "Unknown",
    };
  });

  const brokenLinksFormatted = graph.brokenLinks
    .filter((issue) => {
      if (issue.source !== "note") {
        return true;
      }

      const normalizedReference = normalizeWikilinkReference(issue.reference);
      return !looksLikeRepositoryPath(normalizedReference);
    })
    .map((issue) => ({
      fromNoteId: issue.fromNoteId,
      fromTitle: issue.fromTitle,
      reference: issue.reference,
      source: issue.source,
    }));

  const valid =
    validation.errors.length === 0 &&
    validation.duplicateIds.length === 0 &&
    brokenLinksFormatted.length === 0;

  return {
    duplicateIds: validation.duplicateIds,
    brokenLinks: brokenLinksFormatted,
    codePathWarnings,
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
