import picomatch from "picomatch";

import type { CxConfig, CxSectionConfig } from "../config/types.js";
import { CxError } from "../shared/errors.js";
import {
  listFilesRecursive,
  relativePosix,
  sortLexically,
} from "../shared/fs.js";
import { isSubpath } from "../shared/paths.js";

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
  return config.dedup.order === "lexical" ? sortLexically(names) : names;
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
    const include = compileMatchers(section.include);
    const exclude = compileMatchers(section.exclude);
    if (
      matchesAny(include, relativePath) &&
      !matchesAny(exclude, relativePath)
    ) {
      matches.push(name);
    }
  }

  return matches;
}

export async function listPlannableRelativePaths(
  config: CxConfig,
): Promise<string[]> {
  const allFiles = await listFilesRecursive(config.sourceRoot);
  const outputExcluded = isSubpath(config.sourceRoot, config.outputDir)
    ? relativePosix(config.sourceRoot, config.outputDir)
    : undefined;
  const globalExcludeMatchers = compileMatchers([
    ...config.files.exclude,
    ...(outputExcluded ? [`${outputExcluded}/**`] : []),
  ]);

  return sortLexically(
    allFiles
      .map((filePath) => relativePosix(config.sourceRoot, filePath))
      .filter(
        (relativePath) => !matchesAny(globalExcludeMatchers, relativePath),
      ),
  );
}

export async function analyzeSectionOverlaps(
  config: CxConfig,
): Promise<OverlapConflict[]> {
  const sections = getSectionEntries(config);
  const conflicts: OverlapConflict[] = [];

  for (const relativePath of await listPlannableRelativePaths(config)) {
    const matchingSections = getMatchingSections(relativePath, sections);
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
