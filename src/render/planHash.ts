import { sha256NormalizedText, sha256Text } from "../shared/hashing.js";
import type { StructuredRenderEntry, StructuredRenderPlan } from "./types.js";

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

export function computeAggregatePlanHash(
  sectionPlanHashes: ReadonlyMap<string, string>,
): string | undefined {
  if (sectionPlanHashes.size === 0) {
    return undefined;
  }

  return sha256NormalizedText(
    JSON.stringify(
      Array.from(sectionPlanHashes.entries()).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  );
}

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
