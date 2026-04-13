import fs from "node:fs/promises";
import path from "node:path";

import type { CxConfig, CxSectionConfig } from "../config/types.js";
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

/**
 * Resolve a unique stored filename for flat layout.
 *
 * All candidates are sorted by relativePath for determinism. The first
 * occurrence keeps its original basename; subsequent ones receive a numeric
 * postfix inserted between the base name and the extension, e.g. `logo-2.png`.
 */
function resolveFlat(
  targetDir: string,
  candidates: { relativePath: string }[],
): Map<string, string> {
  const byBasename = new Map<string, string[]>();
  for (const { relativePath } of candidates) {
    const base = path.basename(relativePath);
    const list = byBasename.get(base);
    if (list) {
      list.push(relativePath);
    } else {
      byBasename.set(base, [relativePath]);
    }
  }

  const result = new Map<string, string>();
  for (const [base, paths] of byBasename) {
    paths.sort((a, b) => a.localeCompare(b, "en"));
    const ext = path.extname(base);
    const stem = ext ? base.slice(0, -ext.length) : base;
    for (let i = 0; i < paths.length; i++) {
      const filename = i === 0 ? base : `${stem}-${i + 1}${ext}`;
      result.set(paths[i] as string, `${targetDir}/${filename}`);
    }
  }
  return result;
}

export async function buildBundlePlan(config: CxConfig): Promise<BundlePlan> {
  const planningWarnings: string[] = [];

  if (config.dedup.mode === "fail") {
    const [conflict] = await analyzeSectionOverlaps(config);
    if (conflict) {
      throw new CxError(formatOverlapConflictMessage(conflict), 4);
    }
  } else if (config.dedup.mode === "warn") {
    const conflicts = await analyzeSectionOverlaps(config);
    for (const conflict of conflicts) {
      const message = formatOverlapConflictMessage(conflict);
      planningWarnings.push(message);
      process.stderr.write(`Warning: ${message}\n`);
    }
  }

  const assetIncludeMatchers = compileMatchers(config.assets.include);
  const assetExcludeMatchers = compileMatchers(config.assets.exclude);
  const sectionNames = getSectionOrder(config);
  const sectionEntries = getSectionEntries(config);
  const sectionFiles = new Map<string, PlannedSourceFile[]>(
    sectionNames.map((sectionName) => [sectionName, []]),
  );
  const assetCandidates: Omit<PlannedAsset, "storedPath">[] = [];
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
          assetCandidates.push({
            relativePath,
            absolutePath,
            kind: "asset",
            mediaType: detectMediaType(relativePath, "asset"),
            sizeBytes: stat.size,
            sha256: await sha256File(absolutePath),
            mtime: stat.mtime.toISOString(),
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

  if (config.assets.layout === "flat") {
    const storedPaths = resolveFlat(config.assets.targetDir, assetCandidates);
    for (const candidate of assetCandidates) {
      assets.push({
        ...candidate,
        storedPath: storedPaths.get(candidate.relativePath) as string,
      });
    }
  } else {
    for (const candidate of assetCandidates) {
      assets.push({
        ...candidate,
        storedPath: `${config.assets.targetDir}/${candidate.relativePath}`,
      });
    }
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
      outputFile: `${config.projectName}-repomix-${name}${config.output.extensions[style]}`,
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
    warnings: planningWarnings,
  };
}
