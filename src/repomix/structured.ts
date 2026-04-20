import type * as RepomixTypes from "@wsmy/repomix-cx-fork";

import { validatePlanOrdering } from "../render/ordering.js";
import {
  computePlanHash,
  planToMaps,
  validateEntryHashes,
} from "../render/planHash.js";
import type {
  StructuredRenderEntry,
  StructuredRenderPlan,
} from "../render/types.js";
import { sha256Text } from "../shared/hashing.js";

export type { StructuredRenderEntry, StructuredRenderPlan };

export interface FileSpanMapping {
  path: string;
  startLine: number;
  endLine: number;
}

export interface StructuredRenderResult {
  plan: StructuredRenderPlan;
  rendered: string;
  fileMappings: FileSpanMapping[];
  planHash: string;
}

/**
 * Extract a structured render plan from repomix packStructured result.
 * Computes content hashes and enforces deterministic ordering.
 */
export function extractStructuredPlan(
  structuredPack: Awaited<ReturnType<typeof RepomixTypes.packStructured>>,
): StructuredRenderPlan {
  const entries: StructuredRenderEntry[] = [];

  for (const entry of structuredPack.entries) {
    entries.push({
      path: entry.path,
      content: entry.content,
      sha256: sha256Text(entry.content),
      tokenCount: entry.metadata.tokenCount ?? 0,
      ...(entry.metadata.language === undefined
        ? {}
        : { language: entry.metadata.language }),
    });
  }

  // Sort entries lexicographically for deterministic ordering
  entries.sort((a, b) => a.path.localeCompare(b.path));

  const ordering = entries.map((entry) => entry.path);

  return {
    entries,
    ordering,
  };
}
export {
  computePlanHash,
  planToMaps,
  validateEntryHashes,
  validatePlanOrdering,
};
