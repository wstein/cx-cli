import fs from "node:fs/promises";
import path from "node:path";

import type { CxConfig, CxSectionConfig, CxStyle } from "../config/types.js";
import { CxError } from "../shared/errors.js";
import { sha256File } from "../shared/hashing.js";
import { detectMediaType } from "../shared/mime.js";
import {
  analyzeSectionOverlaps,
  compileMatchers,
  formatOverlapConflictMessage,
  getMatchingSections,
  getSectionEntries,
  getSectionOrder,
  listPlannableRelativePaths,
  matchesAny,
} from "./overlaps.js";
import type {
  BundlePlan,
  PlannedAsset,
  PlannedSection,
  PlannedSourceFile,
} from "./types.js";

function outputExtension(style: CxStyle): string {
  switch (style) {
    case "markdown":
      return "md";
    case "json":
      return "json";
    case "plain":
      return "txt";
    case "xml":
      return "xml.txt";
  }
}

function getRequiredSection(
  sections: Record<string, CxSectionConfig>,
  sectionName: string,
): CxSectionConfig {
  const section = sections[sectionName];
  if (!section) {
    throw new CxError(`Missing section definition for ${sectionName}.`, 2);
  }
  return section;
}

function getRequiredSectionFiles(
  sectionFiles: Map<string, PlannedSourceFile[]>,
  sectionName: string,
): PlannedSourceFile[] {
  const files = sectionFiles.get(sectionName);
  if (!files) {
    throw new CxError(`Missing planned file set for ${sectionName}.`, 2);
  }
  return files;
}

export async function buildBundlePlan(config: CxConfig): Promise<BundlePlan> {
  if (config.dedup.mode === "fail") {
    const [conflict] = await analyzeSectionOverlaps(config);
    if (conflict) {
      throw new CxError(formatOverlapConflictMessage(conflict), 4);
    }
  } else if (config.dedup.mode === "warn") {
    const conflicts = await analyzeSectionOverlaps(config);
    for (const conflict of conflicts) {
      process.stderr.write(
        `Warning: ${formatOverlapConflictMessage(conflict)}\n`,
      );
    }
  }

  const assetIncludeMatchers = compileMatchers(config.assets.include);
  const assetExcludeMatchers = compileMatchers(config.assets.exclude);
  const sectionNames = getSectionOrder(config);
  const sectionEntries = getSectionEntries(config);
  const sectionFiles = new Map<string, PlannedSourceFile[]>(
    sectionNames.map((sectionName) => [sectionName, []]),
  );
  const assets: PlannedAsset[] = [];
  const unmatchedFiles: string[] = [];

  const relativePaths = await listPlannableRelativePaths(config);

  for (const relativePath of relativePaths) {
    const absolutePath = path.join(config.sourceRoot, relativePath);
    const matchingSections = getMatchingSections(relativePath, sectionEntries);
    const isAsset =
      matchesAny(assetIncludeMatchers, relativePath) &&
      !matchesAny(assetExcludeMatchers, relativePath);

    if (isAsset && matchingSections.length > 0) {
      throw new CxError(
        `Asset conflict detected for ${relativePath}: file matches both an asset rule and section ${matchingSections[0]}.`,
        4,
      );
    }

    if (matchingSections.length === 0) {
      if (isAsset) {
        if (config.assets.mode === "fail") {
          throw new CxError(
            `Asset ${relativePath} matched an asset rule while assets.mode=fail.`,
            4,
          );
        }

        if (config.assets.mode === "copy") {
          const stat = await fs.stat(absolutePath);
          assets.push({
            relativePath,
            absolutePath,
            kind: "asset",
            mediaType: detectMediaType(relativePath, "asset"),
            sizeBytes: stat.size,
            sha256: await sha256File(absolutePath),
            mtime: stat.mtime.toISOString(),
            storedPath: `${config.assets.targetDir}/${relativePath}`,
          });
        }
        continue;
      }

      unmatchedFiles.push(relativePath);
      continue;
    }

    const sectionName = matchingSections[0];
    if (!sectionName) {
      throw new CxError(`Missing resolved section for ${relativePath}.`, 2);
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
    };
    getRequiredSectionFiles(sectionFiles, sectionName).push(plannedFile);
  }

  if (config.files.unmatched === "fail" && unmatchedFiles.length > 0) {
    throw new CxError(
      `Unmatched files detected: ${unmatchedFiles.join(", ")}.`,
      2,
    );
  }

  const sections: PlannedSection[] = sectionNames.map((name) => {
    const section = getRequiredSection(config.sections, name);
    const style = section.style ?? config.repomix.style;
    return {
      name,
      style,
      outputFile: `${config.projectName}-repomix-${name}.${outputExtension(style)}`,
      files: getRequiredSectionFiles(sectionFiles, name).sort((left, right) =>
        left.relativePath.localeCompare(right.relativePath, "en"),
      ),
    };
  });

  return {
    projectName: config.projectName,
    sourceRoot: config.sourceRoot,
    bundleDir: config.outputDir,
    checksumFile: config.checksums.fileName,
    sections,
    assets: assets.sort((left, right) =>
      left.relativePath.localeCompare(right.relativePath, "en"),
    ),
    unmatchedFiles,
  };
}
