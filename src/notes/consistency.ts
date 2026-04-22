import fs from "node:fs/promises";
import path from "node:path";

import type { CxSectionConfig } from "../config/types.js";
import { CX_MCP_TOOL_NAMES } from "../mcp/tools/catalog.js";
import { getMatchingSections } from "../planning/overlaps.js";
import { pathExists } from "../shared/fs.js";
import { getVCSState } from "../vcs/provider.js";
import {
  applyContradictionPressure,
  applyDriftPressure,
  type NoteCognitionLabel,
  type NoteStalenessLabel,
  type NoteTrustLevel,
} from "./cognition.js";
import {
  collectNoteContradictions,
  type NoteContradictionIssue,
} from "./contradictions.js";
import { buildNoteGraph } from "./graph.js";
import {
  extractWikilinkReferences,
  looksLikeCodePath,
  normalizeWikilinkReference,
  resolveWikilinkReference,
} from "./linking.js";
import {
  type NoteValidationError,
  type NoteValidationOptions,
  validateNotes,
} from "./validate.js";

export interface NoteCodePathWarning {
  fromNoteId: string;
  fromTitle: string;
  reference: string;
  path: string;
  status: "missing" | "outside_master_list" | "excluded_from_plan";
}

export interface ConsistencyReport {
  duplicateIds: Array<{ id: string; files: string[] }>;
  validationErrors: NoteValidationError[];
  brokenLinks: Array<{
    fromNoteId: string;
    fromTitle: string;
    reference: string;
    source: "note" | "code";
  }>;
  codePathWarnings: NoteCodePathWarning[];
  currentFeatureWarnings: Array<{
    noteId: string;
    noteTitle: string;
    reference: string;
    source: "note" | "code";
    reason: string;
  }>;
  orphans: Array<{ id: string; title: string }>;
  cognition: {
    averageScore: number;
    highSignalCount: number;
    reviewCount: number;
    lowSignalCount: number;
  };
  staleness: {
    averageAgeDays: number;
    freshCount: number;
    agingCount: number;
    staleCount: number;
    driftPressuredCount: number;
  };
  contradictions: {
    count: number;
    codeStateConflictCount: number;
    siblingConflictCount: number;
  };
  contradictionIssues: NoteContradictionIssue[];
  lowSignalNotes: Array<{
    id: string;
    title: string;
    score: number;
    label: NoteCognitionLabel;
    trustLevel: NoteTrustLevel;
    ageDays: number;
    stalenessLabel: NoteStalenessLabel;
    driftWarningCount: number;
    contradictionCount: number;
  }>;
  evaluatedNotes: Array<{
    id: string;
    filePath: string;
    title: string;
    target: "current" | "v0.4" | "v0.5" | "backlog";
    score: number;
    label: NoteCognitionLabel;
    trustLevel: NoteTrustLevel;
    ageDays: number;
    stalenessLabel: NoteStalenessLabel;
    driftWarningCount: number;
    contradictionCount: number;
  }>;
  trustModel: {
    sourceTree: "trusted";
    notes: NoteTrustLevel;
    agentOutput: "untrusted_until_verified";
    bundle: "trusted";
  };
  totalNotes: number;
  valid: boolean;
}

function looksLikeRepositoryPath(reference: string): boolean {
  return looksLikeCodePath(reference);
}

export async function collectNoteCodePathWarnings(
  notes: Awaited<ReturnType<typeof validateNotes>>["notes"],
  projectRoot: string,
  repositoryPaths?: Iterable<string>,
  sectionEntries?: Map<string, CxSectionConfig>,
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
          [...repositoryPaths].map((filePath) =>
            filePath.replaceAll("\\", "/"),
          ),
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
        ? sectionEntries !== undefined &&
          getMatchingSections(normalizedPath, sectionEntries).length === 0
          ? ("excluded_from_plan" as const)
          : null
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
  options?: NoteValidationOptions,
): Promise<ConsistencyReport> {
  const validation = await validateNotes(notesDir, projectRoot, options);
  const graph = await buildNoteGraph(notesDir, projectRoot);
  const codePathWarnings = await collectNoteCodePathWarnings(
    validation.notes,
    projectRoot,
  );
  const contradictionIssues = await collectNoteContradictions(
    validation.notes,
    projectRoot,
    codePathWarnings,
  );
  const driftWarningsByNoteId = new Map<string, number>();
  const contradictionsByNoteId = new Map<string, number>();

  for (const warning of codePathWarnings) {
    driftWarningsByNoteId.set(
      warning.fromNoteId,
      (driftWarningsByNoteId.get(warning.fromNoteId) ?? 0) + 1,
    );
  }
  for (const issue of contradictionIssues) {
    contradictionsByNoteId.set(
      issue.noteId,
      (contradictionsByNoteId.get(issue.noteId) ?? 0) + 1,
    );
  }

  const effectiveNotes = validation.notes.map((note) => {
    const driftWarningCount = driftWarningsByNoteId.get(note.id) ?? 0;
    const contradictionCount = contradictionsByNoteId.get(note.id) ?? 0;
    return {
      ...note,
      cognition: applyContradictionPressure(
        applyDriftPressure(note.cognition, driftWarningCount),
        contradictionCount,
      ),
    };
  });

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

  const averageScore =
    effectiveNotes.length === 0
      ? 0
      : Math.round(
          effectiveNotes.reduce((sum, note) => sum + note.cognition.score, 0) /
            effectiveNotes.length,
        );
  const averageAgeDays =
    effectiveNotes.length === 0
      ? 0
      : Math.round(
          effectiveNotes.reduce(
            (sum, note) => sum + note.cognition.ageDays,
            0,
          ) / effectiveNotes.length,
        );
  const highSignalCount = effectiveNotes.filter(
    (note) => note.cognition.label === "high_signal",
  ).length;
  const reviewCount = effectiveNotes.filter(
    (note) => note.cognition.label === "review",
  ).length;
  const freshCount = effectiveNotes.filter(
    (note) => note.cognition.stalenessLabel === "fresh",
  ).length;
  const agingCount = effectiveNotes.filter(
    (note) => note.cognition.stalenessLabel === "aging",
  ).length;
  const staleCount = effectiveNotes.filter(
    (note) => note.cognition.stalenessLabel === "stale",
  ).length;
  const driftPressuredCount = effectiveNotes.filter(
    (note) => note.cognition.driftWarningCount > 0,
  ).length;
  const codeStateConflictCount = contradictionIssues.filter(
    (issue) => issue.kind === "code_state_conflict",
  ).length;
  const siblingConflictCount = contradictionIssues.filter(
    (issue) => issue.kind === "sibling_claim_conflict",
  ).length;
  const lowSignalNotes = effectiveNotes
    .filter((note) => note.cognition.label === "low_signal")
    .map((note) => ({
      id: note.id,
      title: note.title,
      score: note.cognition.score,
      label: note.cognition.label,
      trustLevel: note.cognition.trustLevel,
      ageDays: note.cognition.ageDays,
      stalenessLabel: note.cognition.stalenessLabel,
      driftWarningCount: note.cognition.driftWarningCount,
      contradictionCount: note.cognition.contradictionCount,
    }))
    .sort(
      (left, right) =>
        left.score - right.score || left.id.localeCompare(right.id),
    );
  const evaluatedNotes = effectiveNotes
    .map((note) => ({
      id: note.id,
      filePath: note.filePath,
      title: note.title,
      target: note.target,
      score: note.cognition.score,
      label: note.cognition.label,
      trustLevel: note.cognition.trustLevel,
      ageDays: note.cognition.ageDays,
      stalenessLabel: note.cognition.stalenessLabel,
      driftWarningCount: note.cognition.driftWarningCount,
      contradictionCount: note.cognition.contradictionCount,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));

  const valid =
    validation.errors.length === 0 &&
    validation.duplicateIds.length === 0 &&
    brokenLinksFormatted.length === 0;

  const currentNotes = new Map(
    validation.notes
      .filter((note) => note.target === "current")
      .map((note) => [note.id, note]),
  );
  const currentFeatureWarnings = [
    ...brokenLinksFormatted
      .filter((issue) => currentNotes.has(issue.fromNoteId))
      .map((issue) => ({
        noteId: issue.fromNoteId,
        noteTitle: issue.fromTitle,
        reference: issue.reference,
        source: issue.source,
        reason: "current note references a missing note or anchor",
      })),
    ...codePathWarnings
      .filter((warning) => currentNotes.has(warning.fromNoteId))
      .map((warning) => ({
        noteId: warning.fromNoteId,
        noteTitle: warning.fromTitle,
        reference: warning.path,
        source: "code" as const,
        reason: `current note references a ${warning.status.replaceAll("_", " ")}`,
      })),
  ];

  return {
    duplicateIds: validation.duplicateIds,
    validationErrors: validation.errors,
    brokenLinks: brokenLinksFormatted,
    codePathWarnings,
    currentFeatureWarnings,
    orphans: orphanDetails,
    cognition: {
      averageScore,
      highSignalCount,
      reviewCount,
      lowSignalCount: lowSignalNotes.length,
    },
    staleness: {
      averageAgeDays,
      freshCount,
      agingCount,
      staleCount,
      driftPressuredCount,
    },
    contradictions: {
      count: contradictionIssues.length,
      codeStateConflictCount,
      siblingConflictCount,
    },
    contradictionIssues,
    lowSignalNotes,
    evaluatedNotes,
    trustModel: {
      sourceTree: "trusted",
      notes: "conditional",
      agentOutput: "untrusted_until_verified",
      bundle: "trusted",
    },
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
