import fs from "node:fs/promises";
import path from "node:path";

import type { CxConfig, CxSectionConfig } from "../config/types.js";
import { CxError } from "../shared/errors.js";
import { pathExists } from "../shared/fs.js";
import { sha256File } from "../shared/hashing.js";
import { detectMediaType } from "../shared/mime.js";
import { classifyDirtyState, getVCSState } from "../vcs/provider.js";
import {
  analyzeSectionOverlaps,
  buildMasterList,
  compileMatchers,
  formatOverlapConflictMessage,
  getMatchingSections,
  getSectionEntries,
  getSectionOrder,
  matchesAny,
} from "./overlaps.js";
import type { OverlapConflict } from "./overlaps.js";
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

function formatOverlapConflictsMessage(conflicts: OverlapConflict[]): string {
  if (conflicts.length === 1) {
    return formatOverlapConflictMessage(conflicts[0] as OverlapConflict);
  }

  const conflictMessages = conflicts
    .map((conflict) =>
      formatOverlapConflictMessage(conflict)
        .split("\n")
        .map((line, index) => (index === 0 ? `- ${line}` : `  ${line}`))
        .join("\n"),
    )
    .join("\n");

  return [
    `Section overlap detected in ${conflicts.length} locations.`,
    conflictMessages,
  ].join("\n");
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

  // Phase 1: Base Generation — establish the VCS-driven master file list.
  //
  // The VCS-tracked file list is the authoritative source of files for this
  // project. `files.include` can extend it with non-VCS files; `files.exclude`
  // unconditionally strips sensitive entries before any section glob runs.
  const vcsState = await getVCSState(config.sourceRoot);
  const masterList = await buildMasterList(config, vcsState);
  const dirtyState = classifyDirtyState(vcsState);

  // Phase 2: Overlap analysis (operates on the master list, not the disk).
  if (config.dedup.mode === "fail") {
    const conflicts = await analyzeSectionOverlaps(config, masterList);
    if (conflicts.length > 0) {
      throw new CxError(formatOverlapConflictsMessage(conflicts), 4);
    }
  } else if (config.dedup.mode === "warn") {
    const conflicts = await analyzeSectionOverlaps(config, masterList);
    for (const conflict of conflicts) {
      const message = formatOverlapConflictMessage(conflict);
      planningWarnings.push(message);
      process.stderr.write(`Warning: ${message}\n`);
    }
  }

  // Phase 3: Pool sorting — distribute masterList files into sections.
  //
  // Files are removed from `availablePool` as they are claimed. Normal
  // sections are processed first in priority order; the optional catch-all
  // section absorbs whatever remains after normal processing.

  const assetIncludeMatchers = compileMatchers(config.assets.include);
  const assetExcludeMatchers = compileMatchers(config.assets.exclude);
  const sectionOrder = getSectionOrder(config);
  const sectionEntries = getSectionEntries(config);

  // Split sections into normal (glob-based) and catch-all.
  const normalSectionNames: string[] = [];
  const catchAllSectionNames: string[] = [];
  for (const name of sectionOrder) {
    const sec = config.sections[name];
    if (sec?.catch_all) {
      catchAllSectionNames.push(name);
    } else {
      normalSectionNames.push(name);
    }
  }

  if (catchAllSectionNames.length > 1) {
    throw new CxError(
      `Only one catch_all section is allowed per project, but found ${catchAllSectionNames.length}: ${catchAllSectionNames.join(", ")}.`,
      2,
    );
  }

  const normalSectionEntries = new Map(
    normalSectionNames.map((name) => {
      const sectionEntry = sectionEntries.get(name);
      if (sectionEntry === undefined) {
        throw new CxError(`Missing section entry for ${name}.`, 2);
      }
      return [name, sectionEntry];
    }),
  );

  const sectionFiles = new Map<string, PlannedSourceFile[]>(
    sectionOrder.map((name) => [name, []]),
  );
  const assetCandidates: Omit<PlannedAsset, "storedPath">[] = [];
  const assets: PlannedAsset[] = [];
  const unmatchedFiles: string[] = [];

  // The pool starts as the full master list. Files are removed as they are
  // claimed by assets or sections.
  const availablePool = new Set<string>(masterList);

  for (const relativePath of masterList) {
    const absolutePath = path.join(config.sourceRoot, relativePath);
    const matchingSections = getMatchingSections(
      relativePath,
      normalSectionEntries,
    );
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
          if (!(await pathExists(absolutePath))) {
            availablePool.delete(relativePath);
            continue;
          }
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
        availablePool.delete(relativePath);
        continue;
      }

      // Leave in pool — the catch-all section (if present) will claim it.
      continue;
    }

    const sectionName = matchingSections[0];
    if (!sectionName) {
      throw new CxError(`Missing resolved section for ${relativePath}.`, 2);
    }
    if (!(await pathExists(absolutePath))) {
      availablePool.delete(relativePath);
      continue;
    }
    availablePool.delete(relativePath);
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

  // Phase 4: Catch-all resolution — assign remaining pool to the catch-all
  // section (if defined), then report any leftovers as unmatched.
  if (catchAllSectionNames.length === 1) {
    const catchAllName = catchAllSectionNames[0];
    if (!catchAllName) {
      throw new CxError("Missing catch-all section name.", 2);
    }
    const catchAllSection = config.sections[catchAllName];
    if (!catchAllSection) {
      throw new CxError(
        `Missing catch-all section configuration for ${catchAllName}.`,
        2,
      );
    }
    const catchAllExcludeMatchers = compileMatchers(catchAllSection.exclude);

    for (const relativePath of [...availablePool]) {
      if (matchesAny(catchAllExcludeMatchers, relativePath)) {
        // Explicitly excluded from the catch-all — treat as unmatched.
        unmatchedFiles.push(relativePath);
        availablePool.delete(relativePath);
        continue;
      }
      const absolutePath = path.join(config.sourceRoot, relativePath);
      if (!(await pathExists(absolutePath))) {
        availablePool.delete(relativePath);
        continue;
      }
      availablePool.delete(relativePath);
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
      getRequiredSectionFiles(sectionFiles, catchAllName).push(plannedFile);
    }
  }

  // Any file still in the pool after normal and catch-all processing is
  // "unmatched" — it is in the VCS tree but claimed by no section.
  for (const relativePath of availablePool) {
    unmatchedFiles.push(relativePath);
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

  const sections: PlannedSection[] = sectionOrder.map((name) => {
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
    vcsKind: vcsState.kind,
    dirtyState,
    modifiedFiles: dirtyState === "unsafe_dirty" ? vcsState.modifiedFiles : [],
  };
}
