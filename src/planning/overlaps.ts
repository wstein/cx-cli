import picomatch from "picomatch";

import type { CxConfig, CxSectionConfig } from "../config/types.js";
import { CxError } from "../shared/errors.js";
import { sortLexically } from "../shared/fs.js";

export interface OverlapSuggestion {
  section: string;
  pattern: string;
}

export interface OverlapConflict {
  path: string;
  sections: string[];
  recommendedOwner: string;
  suggestions: OverlapSuggestion[];
}

export function compileMatchers(
  patterns: string[],
): Array<(value: string) => boolean> {
  return patterns.map((pattern) => picomatch(pattern, { dot: true }));
}

export function matchesAny(
  matchers: Array<(value: string) => boolean>,
  value: string,
): boolean {
  return matchers.some((matcher) => matcher(value));
}

export function getSectionOrder(config: CxConfig): string[] {
  const names = Object.keys(config.sections);
  const base = config.dedup.order === "lexical" ? sortLexically(names) : names;

  // Sort descending by priority. JavaScript's Array.sort is stable, so
  // sections without an explicit priority (treated as 0) preserve their
  // relative base order, whether that base order is config-position or lexical.
  return [...base].sort((a, b) => {
    const pa = config.sections[a]?.priority ?? 0;
    const pb = config.sections[b]?.priority ?? 0;
    return pb - pa;
  });
}

export function getSectionEntries(
  config: CxConfig,
): Map<string, CxSectionConfig> {
  return new Map(
    getSectionOrder(config).map((name) => [
      name,
      getRequiredSection(config, name),
    ]),
  );
}

export function getMatchingSections(
  relativePath: string,
  sections: Map<string, CxSectionConfig>,
): string[] {
  const matches: string[] = [];

  for (const [name, section] of sections.entries()) {
    const include = compileMatchers(section.include ?? []);
    const exclude = compileMatchers(section.exclude);
    if (
      include.length > 0 &&
      matchesAny(include, relativePath) &&
      !matchesAny(exclude, relativePath)
    ) {
      matches.push(name);
    }
  }

  return matches;
}

export async function analyzeSectionOverlaps(
  config: CxConfig,
  masterList: string[],
): Promise<OverlapConflict[]> {
  // Only non-catch-all sections participate in overlap analysis.
  const normalSections = new Map(
    [...getSectionEntries(config)].filter(([, sec]) => !sec.catch_all),
  );
  const conflicts: OverlapConflict[] = [];

  for (const relativePath of masterList) {
    const matchingSections = getMatchingSections(relativePath, normalSections);
    if (matchingSections.length <= 1) {
      continue;
    }

    const [recommendedOwner, ...sectionsToExclude] = matchingSections;
    if (!recommendedOwner) {
      continue;
    }

    conflicts.push({
      path: relativePath,
      sections: matchingSections,
      recommendedOwner,
      suggestions: sectionsToExclude.map((section) => ({
        section,
        pattern: relativePath,
      })),
    });
  }

  return conflicts;
}

export function formatOverlapConflictMessage(
  conflict: OverlapConflict,
): string {
  const suggestionLines =
    conflict.suggestions.length === 0
      ? "  none"
      : conflict.suggestions
          .map(
            (suggestion) =>
              `  [sections.${suggestion.section}] exclude += ${JSON.stringify(
                suggestion.pattern,
              )}`,
          )
          .join("\n");

  return [
    `Section overlap detected for ${conflict.path}.`,
    `Matching sections: ${conflict.sections.join(", ")}.`,
    `Recommended owner: ${conflict.recommendedOwner}.`,
    "Suggested exclude rules:",
    suggestionLines,
    "Run `cx doctor fix-overlaps --dry-run` to review the full resolution plan.",
    'Alternatively, set `dedup.mode = "first-wins"` and assign a higher `priority` to the',
    "section that should own the file to resolve overlaps dynamically at runtime.",
  ].join("\n");
}

function getRequiredSection(
  config: CxConfig,
  sectionName: string,
): CxSectionConfig {
  const section = config.sections[sectionName];
  if (!section) {
    throw new CxError(`Missing section definition for ${sectionName}.`, 2);
  }
  return section;
}
