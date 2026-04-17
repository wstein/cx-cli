import type * as RepomixTypes from "@wsmy/repomix-cx-fork";

import { sha256Text } from "../shared/hashing.js";

/**
 * Single entry in a structured render plan.
 * Represents deterministic content and metadata for one file.
 */
export interface StructuredRenderEntry {
  path: string;
  content: string;
  sha256: string;
  tokenCount: number;
}

/**
 * Deterministic ordering metadata for a render plan.
 * Files are sorted lexicographically by path.
 */
export interface StructuredRenderPlan {
  entries: StructuredRenderEntry[];
  ordering: string[]; // Canonical paths in order
}

/**
 * File span mapping from render output.
 * Maps file paths to their line positions in rendered output.
 */
export interface FileSpanMapping {
  path: string;
  startLine: number;
  endLine: number;
}

/**
 * Structured render result with deterministic content hashes
 * and optional span mappings.
 */
export interface StructuredRenderResult {
  plan: StructuredRenderPlan;
  rendered: string;
  fileMappings: FileSpanMapping[];
  planHash: string; // sha256(JSON.stringify(plan))
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

/**
 * Compute the plan hash: sha256 of the deterministic JSON representation.
 * This provides integrity verification of the render plan itself.
 */
export function computePlanHash(plan: StructuredRenderPlan): string {
  const planJson = JSON.stringify({
    ordering: plan.ordering,
    entries: plan.entries.map((entry) => ({
      path: entry.path,
      sha256: entry.sha256,
      tokenCount: entry.tokenCount,
    })),
  });

  return sha256Text(planJson);
}

/**
 * Convert StructuredRenderPlan into maps for backwards compatibility
 * and efficient lookup during manifest building.
 */
export function planToMaps(plan: StructuredRenderPlan): {
  fileTokenCounts: Map<string, number>;
  fileContentHashes: Map<string, string>;
} {
  const fileTokenCounts = new Map<string, number>();
  const fileContentHashes = new Map<string, string>();

  for (const entry of plan.entries) {
    fileTokenCounts.set(entry.path, entry.tokenCount);
    fileContentHashes.set(entry.path, entry.sha256);
  }

  return { fileTokenCounts, fileContentHashes };
}

/**
 * Invariant check: verify that plan ordering is deterministic (sorted).
 */
export function validatePlanOrdering(plan: StructuredRenderPlan): boolean {
  for (let i = 1; i < plan.ordering.length; i++) {
    const current = plan.ordering[i];
    const prev = plan.ordering[i - 1];
    if (current && prev && current <= prev) {
      return false;
    }
  }
  return true;
}

/**
 * Invariant check: verify that all entries have consistent hashes.
 * (Used during roundtrip verification to ensure content didn't drift.)
 */
export function validateEntryHashes(
  entries: StructuredRenderEntry[],
): Map<string, string> {
  const errors = new Map<string, string>();

  for (const entry of entries) {
    const computed = sha256Text(entry.content);
    if (computed !== entry.sha256) {
      errors.set(
        entry.path,
        `hash mismatch: expected ${entry.sha256}, got ${computed}`,
      );
    }
  }

  return errors;
}
