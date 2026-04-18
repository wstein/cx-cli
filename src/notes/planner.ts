import fs from "node:fs/promises";

import type { CxConfig } from "../config/types.js";
import type { BundlePlan, PlannedSourceFile } from "../planning/types.js";
import { pathExists, relativePosix } from "../shared/fs.js";
import { sha256File } from "../shared/hashing.js";
import { detectMediaType } from "../shared/mime.js";
import { buildNoteGraph } from "./graph.js";

/**
 * Enrich a bundle plan by injecting linked notes into their target section.
 *
 * This step runs after the VCS-driven planning phase when
 * `config.manifest.includeLinkedNotes` is enabled. It keeps the core planner
 * free of any notes-domain knowledge and treats note injection as a separate
 * orchestration concern.
 *
 * The function mutates the plan's section file lists in place and returns the
 * same plan reference so callers can chain it naturally.
 */
export async function enrichPlanWithLinkedNotes(
  plan: BundlePlan,
  config: CxConfig,
): Promise<BundlePlan> {
  if (!config.manifest.includeLinkedNotes) {
    return plan;
  }

  const noteGraph = await buildNoteGraph("notes", config.sourceRoot);
  const linkedNoteIds = new Set<string>();
  for (const link of noteGraph.links) {
    linkedNoteIds.add(link.toNoteId);
  }

  const sectionOrder = plan.sections.map((section) => section.name);
  const targetSectionName = sectionOrder.includes("docs")
    ? "docs"
    : sectionOrder[0];

  if (!targetSectionName) {
    return plan;
  }

  const targetSection = plan.sections.find(
    (section) => section.name === targetSectionName,
  );
  if (!targetSection) {
    return plan;
  }

  const existingPaths = new Set<string>(
    plan.sections.flatMap((section) =>
      section.files.map((file) => file.relativePath),
    ),
  );

  // Build a set of files still eligible for injection (not yet claimed by any
  // section, not already in assets). Mimic the planner's availablePool check.
  const claimedPaths = new Set<string>([
    ...existingPaths,
    ...plan.assets.map((asset) => asset.relativePath),
  ]);

  for (const noteId of linkedNoteIds) {
    const note = noteGraph.notes.get(noteId);
    if (!note) {
      continue;
    }

    const relativePath = relativePosix(config.sourceRoot, note.filePath);
    if (claimedPaths.has(relativePath)) {
      continue;
    }

    const absolutePath = note.filePath;
    if (!(await pathExists(absolutePath))) {
      continue;
    }

    const stat = await fs.stat(absolutePath);
    const plannedFile: PlannedSourceFile = {
      relativePath,
      absolutePath,
      kind: "text",
      mediaType: detectMediaType(relativePath, "text"),
      sizeBytes: stat.size,
      sha256: await sha256File(absolutePath),
      mtime: stat.mtime.toISOString(),
      provenance: ["linked_note_enrichment", "manifest_note_inclusion"],
    };
    targetSection.files.push(plannedFile);
    claimedPaths.add(relativePath);
  }

  // Re-sort the target section so the result is deterministic.
  targetSection.files.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath, "en"),
  );

  return plan;
}
