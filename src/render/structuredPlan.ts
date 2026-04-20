import type * as RepomixTypes from "@wsmy/repomix-cx-fork";
import { sha256Text } from "../shared/hashing.js";
import type { StructuredRenderEntry, StructuredRenderPlan } from "./types.js";

/**
 * Extract a kernel-owned structured render plan from adapter output.
 *
 * The adapter may remain the temporary oracle, but the deterministic plan we
 * verify against belongs to the render kernel.
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

  entries.sort((left, right) => left.path.localeCompare(right.path));

  return {
    entries,
    ordering: entries.map((entry) => entry.path),
  };
}
