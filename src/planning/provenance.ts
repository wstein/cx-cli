import type { InclusionProvenance } from "./types.js";

export const INCLUSION_PROVENANCE_ORDER: InclusionProvenance[] = [
  "section_match",
  "catch_all_section_match",
  "asset_rule_match",
  "linked_note_enrichment",
  "manifest_note_inclusion",
];

export interface InclusionProvenanceSummary {
  marker: InclusionProvenance;
  count: number;
}

export function sortInclusionProvenance(
  provenance: InclusionProvenance[],
): InclusionProvenance[] {
  const unique = [...new Set(provenance)];
  return unique.sort((left, right) => {
    const leftIndex = INCLUSION_PROVENANCE_ORDER.indexOf(left);
    const rightIndex = INCLUSION_PROVENANCE_ORDER.indexOf(right);
    if (leftIndex === rightIndex) {
      return 0;
    }
    if (leftIndex === -1) {
      return 1;
    }
    if (rightIndex === -1) {
      return -1;
    }
    return leftIndex - rightIndex;
  });
}

export function summarizeInclusionProvenance(
  entries: Array<{ provenance: InclusionProvenance[] }>,
): InclusionProvenanceSummary[] {
  const counts = new Map<InclusionProvenance, number>();

  for (const entry of entries) {
    for (const marker of entry.provenance) {
      counts.set(marker, (counts.get(marker) ?? 0) + 1);
    }
  }

  return INCLUSION_PROVENANCE_ORDER.flatMap((marker) => {
    const count = counts.get(marker);
    return count === undefined ? [] : [{ marker, count }];
  });
}
