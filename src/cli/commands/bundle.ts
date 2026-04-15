import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { validateBundle } from "../../bundle/validate.js";
import { getCLIOverrides, readEnvOverrides } from "../../config/env.js";
import { loadCxConfig } from "../../config/load.js";
import type { CxAssetsLayout, CxStyle } from "../../config/types.js";
import { buildManifest } from "../../manifest/build.js";
import { writeChecksumFile } from "../../manifest/checksums.js";
import { renderManifestJson } from "../../manifest/json.js";
import {
  type CxLockFile,
  lockFileName,
  writeLock,
} from "../../manifest/lock.js";
import type {
  SectionHashMaps,
  SectionSpanMaps,
  SectionTokenMaps,
} from "../../manifest/types.js";
import { enrichPlanWithLinkedNotes } from "../../notes/planner.js";
import { validateNotes } from "../../notes/validate.js";
import { buildBundlePlan } from "../../planning/buildPlan.js";
import { buildBundleIndexText } from "../../repomix/handover.js";
import {
  getRepomixCapabilities,
  renderSectionWithRepomix,
} from "../../repomix/render.js";
import { CxError } from "../../shared/errors.js";
import {
  formatBytes,
  formatNumber,
  printDivider,
  printHeader,
  printSubheader,
  printSuccess,
  printTable,
  printWarning,
} from "../../shared/format.js";
import {
  ensureDir,
  listFilesRecursive,
  relativePosix,
} from "../../shared/fs.js";
import { sha256File } from "../../shared/hashing.js";
import { writeJson } from "../../shared/output.js";
import { countTokens } from "../../shared/tokens.js";
import { CX_VERSION } from "../../shared/version.js";
import type { DirtyState } from "../../vcs/provider.js";

export interface BundleArgs {
  config: string;
  json?: boolean | undefined;
  layout?: CxAssetsLayout | undefined;
  update?: boolean | undefined;
  /**
   * Override the unsafe-dirty safety check for local development use.
   *
   * By default, `cx bundle` aborts with exit code 7 when the working tree
   * contains uncommitted changes to VCS-tracked files. Passing `--force`
   * bypasses this check and records the effective state as "forced_dirty" in
   * the manifest so the LLM knows it is reading uncommitted work.
   *
   * Prefer `--ci` in automated pipelines; `--force` is intended for local
   * experimentation where a human is present to acknowledge the risk.
   */
  force?: boolean | undefined;
  /**
   * CI/automation mode: bypass the unsafe-dirty safety check without human
   * acknowledgment.
   *
   * Records the effective state as "ci_dirty" in the manifest — distinct from
   * "forced_dirty" — so audit tooling can distinguish automated pipeline
   * overrides from local developer overrides.
   *
   * Implies non-interactive output: no wizard prompts, no ANSI formatting
   * beyond standard stderr warnings.
   */
  ci?: boolean | undefined;
}

interface RenderedSectionArtifacts {
  name: string;
  style: string;
  outputFile: string;
  sizeBytes: number;
  fileCount: number;
  tokenCount: number;
  outputTokenCount: number;
  outputSha256: string;
  warnings: string[];
  fileTokenCounts: Map<string, number>;
  fileContentHashes: Map<string, string>;
  fileSpans?: Map<string, { outputStartLine: number; outputEndLine: number }>;
}

function assertSafeBundleRelativePath(value: string): void {
  if (value.length === 0 || path.isAbsolute(value)) {
    throw new CxError(`Unsafe bundle output path '${value}'.`, 2);
  }
  const normalized = path.normalize(value);
  if (normalized === ".." || normalized.startsWith(`..${path.sep}`)) {
    throw new CxError(`Unsafe bundle output path '${value}'.`, 2);
  }
}

async function ensureSafePruneTarget(finalDir: string): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.readdir(finalDir);
  } catch {
    return;
  }

  if (entries.length === 0) {
    return;
  }

  const hasBundleMarker = entries.some(
    (entry) => entry.endsWith("-manifest.json") || entry.endsWith("-lock.json"),
  );
  if (!hasBundleMarker) {
    throw new CxError(
      `Refusing --update prune for '${finalDir}': target does not appear to be a cx bundle directory (missing *-manifest.json or *-lock.json).`,
      4,
    );
  }
}

async function pruneEmptyDirectories(rootDir: string): Promise<void> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const childPath = path.join(rootDir, entry.name);
    await pruneEmptyDirectories(childPath);
    const childEntries = await fs.readdir(childPath);
    if (childEntries.length === 0) {
      await fs.rmdir(childPath);
    }
  }
}

async function performDifferentialSync(params: {
  stagingDir: string;
  finalDir: string;
  expectedFiles: string[];
}): Promise<void> {
  const { stagingDir, finalDir, expectedFiles } = params;
  await fs.mkdir(finalDir, { recursive: true });
  await ensureSafePruneTarget(finalDir);

  for (const relativePath of expectedFiles) {
    assertSafeBundleRelativePath(relativePath);
    const stagePath = path.join(stagingDir, relativePath);
    const finalPath = path.join(finalDir, relativePath);

    let needsUpdate = true;
    try {
      const [stageHash, finalHash] = await Promise.all([
        sha256File(stagePath),
        sha256File(finalPath),
      ]);
      needsUpdate = stageHash !== finalHash;
    } catch {
      needsUpdate = true;
    }

    if (needsUpdate) {
      await fs.mkdir(path.dirname(finalPath), { recursive: true });
      await fs.copyFile(stagePath, finalPath);
    }
  }

  const expectedSet = new Set(expectedFiles.map((filePath) => filePath));
  const existingFiles = await listFilesRecursive(finalDir);
  for (const existingFile of existingFiles) {
    const relativePath = relativePosix(finalDir, existingFile);
    if (!expectedSet.has(relativePath)) {
      await fs.rm(existingFile, { force: true });
    }
  }

  await pruneEmptyDirectories(finalDir);
}

export async function runBundleCommand(args: BundleArgs): Promise<number> {
  const config = await loadCxConfig(args.config, readEnvOverrides(), {
    ...getCLIOverrides(),
    ...(args.layout !== undefined && { assetsLayout: args.layout }),
  });
  const plan = await enrichPlanWithLinkedNotes(
    await buildBundlePlan(config),
    config,
  );

  // Validate notes in the source directory
  const notesResult = await validateNotes("notes", plan.sourceRoot);
  if (!notesResult.valid) {
    if (notesResult.errors.length > 0) {
      printWarning("Note validation errors:");
      for (const error of notesResult.errors) {
        process.stderr.write(`  ${error.filePath}: ${error.error}\n`);
      }
    }
    if (notesResult.duplicateIds.length > 0) {
      printWarning("Duplicate note IDs detected:");
      for (const { id, files } of notesResult.duplicateIds) {
        process.stderr.write(`  ID ${id}: ${files.join(", ")}\n`);
      }
    }
    throw new CxError("Note validation failed", 10);
  }

  const ciMode = args.ci ?? false;
  const forceMode = args.force ?? false;

  // Dirty-state enforcement: abort on unsafe working trees unless the operator
  // explicitly passes --force (local) or --ci (pipeline) to acknowledge the
  // risk. Both flags bypass exit code 7 but record different manifest states so
  // audit tooling can distinguish human overrides from pipeline overrides.
  if (plan.dirtyState === "unsafe_dirty") {
    if (!forceMode && !ciMode) {
      const listed = plan.modifiedFiles.slice(0, 10).join(", ");
      const more =
        plan.modifiedFiles.length > 10
          ? ` … and ${plan.modifiedFiles.length - 10} more`
          : "";
      throw new CxError(
        `Refusing to bundle: ${plan.modifiedFiles.length} VCS-tracked file(s) have uncommitted changes: ${listed}${more}.\n\n` +
          "This is a safety check — bundles should reflect your VCS state, not your working directory.\n\n" +
          "To proceed, choose one:\n" +
          "  --force     Bundle with local changes (records 'forced_dirty' in manifest — use for local dev)\n" +
          "  --ci        Bundle with local changes (records 'ci_dirty' in manifest — use in CI/CD pipelines)\n\n" +
          "For details, see: docs/ARCHITECTURE.md#dirty-state-taxonomy",
        7,
      );
    }
    const recordedState = ciMode ? "ci_dirty" : "forced_dirty";
    process.stderr.write(
      `Warning: bundling with uncommitted changes in ${plan.modifiedFiles.length} file(s). The manifest will record dirty state as '${recordedState}'.\n`,
    );
  }

  // Resolve the effective dirty state written to the manifest. An unsafe_dirty
  // plan becomes ci_dirty (--ci) or forced_dirty (--force) when the operator
  // explicitly bypasses the safety check.
  const effectiveDirtyState: Exclude<DirtyState, "unsafe_dirty"> =
    plan.dirtyState === "unsafe_dirty"
      ? ciMode
        ? ("ci_dirty" as const)
        : ("forced_dirty" as const)
      : (plan.dirtyState as Exclude<DirtyState, "unsafe_dirty">);

  const effectiveModifiedFiles =
    effectiveDirtyState === "forced_dirty" || effectiveDirtyState === "ci_dirty"
      ? plan.modifiedFiles
      : [];
  const requiresOutputSpans = plan.sections.some(
    (section) => section.style !== "json",
  );

  if (requiresOutputSpans && !config.manifest.includeOutputSpans) {
    throw new CxError(
      "Bundles with XML, Markdown, or plain sections require manifest.include_output_spans = true.",
      5,
    );
  }

  const updateMode = args.update ?? false;
  const stagingRoot = updateMode
    ? await fs.mkdtemp(path.join(os.tmpdir(), "cx-bundle-update-"))
    : null;
  const activeBundleDir = stagingRoot ?? plan.bundleDir;

  await ensureDir(activeBundleDir);

  try {
    await Promise.all(
      plan.assets.map(async (asset) => {
        const destination = path.join(activeBundleDir, asset.storedPath);
        await ensureDir(path.dirname(destination));
        await fs.copyFile(asset.absolutePath, destination);
      }),
    );

    const bundleIndexFile = `${plan.projectName}-bundle-index.txt`;
    const renderedSections: RenderedSectionArtifacts[] = await Promise.all(
      plan.sections.map(async (section) => {
        const outputPath = path.join(activeBundleDir, section.outputFile);
        const renderResult = await renderSectionWithRepomix({
          config,
          style: section.style,
          sourceRoot: plan.sourceRoot,
          outputPath,
          sectionName: section.name,
          explicitFiles: section.files.map((file) => file.absolutePath),
          bundleIndexFile,
          requireStructured: true,
          requireOutputSpans: requiresOutputSpans,
        });

        const totalSectionBytes = section.files.reduce(
          (sum, file) => sum + file.sizeBytes,
          0,
        );
        const outputTokenCount = countTokens(
          renderResult.outputText,
          config.tokens.encoding,
        );

        return {
          name: section.name,
          style: section.style,
          outputFile: section.outputFile,
          sizeBytes: totalSectionBytes,
          fileCount: section.files.length,
          tokenCount: renderResult.outputTokenCount,
          outputTokenCount,
          outputSha256: await sha256File(outputPath),
          warnings: renderResult.warnings,
          fileTokenCounts: renderResult.fileTokenCounts,
          fileContentHashes: renderResult.fileContentHashes,
          ...(renderResult.fileSpans !== undefined
            ? { fileSpans: renderResult.fileSpans }
            : {}),
        };
      }),
    );

    const sectionOutputs = renderedSections.map(
      (
        section,
      ): {
        name: string;
        style: CxStyle;
        outputFile: string;
        outputSha256: string;
        fileCount: number;
        sizeBytes: number;
        tokenCount: number;
        outputTokenCount: number;
      } => ({
        name: section.name,
        style: section.style as CxStyle,
        outputFile: section.outputFile,
        outputSha256: section.outputSha256,
        fileCount: section.fileCount,
        sizeBytes: section.sizeBytes,
        tokenCount: section.tokenCount,
        outputTokenCount: section.outputTokenCount,
      }),
    );
    const sectionSpanMaps: SectionSpanMaps = new Map();
    const sectionTokenMaps: SectionTokenMaps = new Map();
    const sectionHashMaps: SectionHashMaps = new Map();
    const renderWarnings: string[] = [];

    for (const section of renderedSections) {
      renderWarnings.push(...section.warnings);
      sectionTokenMaps.set(section.name, section.fileTokenCounts);
      sectionHashMaps.set(section.name, section.fileContentHashes);
      if (section.fileSpans) {
        sectionSpanMaps.set(section.name, section.fileSpans);
      }
    }

    await fs.writeFile(
      path.join(activeBundleDir, bundleIndexFile),
      buildBundleIndexText({
        projectName: plan.projectName,
        sectionOutputs,
        assetPaths: plan.assets.map((asset) => ({
          sourcePath: asset.relativePath,
          storedPath: asset.storedPath,
        })),
      }),
      "utf8",
    );

    // Extract notes metadata if present
    const notesRecords =
      notesResult.valid && notesResult.notes.length > 0
        ? notesResult.notes.map((note) => ({
            id: note.id,
            title: note.title,
            fileName: note.fileName,
            aliases: note.aliases ?? [],
            tags: note.tags ?? [],
            summary: note.summary,
            lastModified: new Date().toISOString(),
          }))
        : undefined;

    const manifest = buildManifest({
      config,
      plan,
      sectionOutputs,
      bundleIndexFile,
      cxVersion: CX_VERSION,
      repomixVersion: (await getRepomixCapabilities()).packageVersion,
      sectionSpanMaps,
      sectionTokenMaps,
      sectionHashMaps,
      dirtyState: effectiveDirtyState,
      modifiedFiles: effectiveModifiedFiles,
      notes: notesRecords,
    });
    const manifestName = `${plan.projectName}-manifest.json`;
    await fs.writeFile(
      path.join(activeBundleDir, manifestName),
      renderManifestJson(manifest, config.manifest.pretty),
      "utf8",
    );

    // Write the lock file capturing the effective behavioral settings used
    // during this bundle run. cx verify reads it and warns on drift.
    const lockFile: CxLockFile = {
      schemaVersion: 1,
      cxVersion: CX_VERSION,
      bundledAt: new Date().toISOString(),
      bundleMode: ciMode ? "ci" : "local",
      behavioralSettings: {
        "dedup.mode": {
          value: config.dedup.mode,
          source: config.behaviorSources.dedupMode,
        },
        "repomix.missing_extension": {
          value: config.behavior.repomixMissingExtension,
          source: config.behaviorSources.repomixMissingExtension,
        },
        "config.duplicate_entry": {
          value: config.behavior.configDuplicateEntry,
          source: config.behaviorSources.configDuplicateEntry,
        },
        "assets.layout": {
          value: config.assets.layout,
          source: config.behaviorSources.assetsLayout,
        },
        "manifest.include_linked_notes": {
          value: config.manifest.includeLinkedNotes ? "true" : "false",
          source: "cx.toml",
        },
      },
    };
    await writeLock(activeBundleDir, plan.projectName, lockFile);

    const expectedFiles = [
      manifestName,
      lockFileName(plan.projectName),
      bundleIndexFile,
      ...plan.sections.map((section) => section.outputFile),
      ...plan.assets.map((asset) => asset.storedPath),
      plan.checksumFile,
    ];

    await writeChecksumFile(activeBundleDir, plan.checksumFile, [
      manifestName,
      lockFileName(plan.projectName),
      bundleIndexFile,
      ...plan.sections.map((section) => section.outputFile),
      ...plan.assets.map((asset) => asset.storedPath),
    ]);

    await validateBundle(activeBundleDir);

    if (updateMode) {
      await performDifferentialSync({
        stagingDir: activeBundleDir,
        finalDir: plan.bundleDir,
        expectedFiles,
      });
    }

    await validateBundle(plan.bundleDir);

    // Calculate total statistics
    const totalAssetBytes = plan.assets.reduce(
      (sum, asset) => sum + asset.sizeBytes,
      0,
    );
    const totalSectionBytes = sectionOutputs.reduce(
      (sum, section) => sum + section.sizeBytes,
      0,
    );
    const totalTokens = sectionOutputs.reduce(
      (sum, section) => sum + section.tokenCount,
      0,
    );
    const totalOutputTokens = sectionOutputs.reduce(
      (sum, section) => sum + section.outputTokenCount,
      0,
    );

    // Print human-friendly report
    if (!(args.json ?? false)) {
      printHeader("Bundle Summary");
      printTable([
        ["Project", plan.projectName],
        ["Location", plan.bundleDir],
        ["Handover index", bundleIndexFile],
      ]);
      printTable([
        ["Mode", "Immutable snapshot"],
        ["Use MCP", "For live workspace exploration and note updates"],
      ]);
      printDivider();
      printTable([
        ["Sections", plan.sections.length],
        ["Assets", plan.assets.length],
        ["Unmatched files", plan.unmatchedFiles.length],
      ]);
      printDivider();

      // Section details
      printSubheader("Sections");
      for (const section of sectionOutputs) {
        printTable([
          [`  ${section.name}`, ""],
          ["    Files", section.fileCount],
          ["    Size", formatBytes(section.sizeBytes)],
          ["    Packed tokens", formatNumber(section.tokenCount)],
          ["    Output tokens", formatNumber(section.outputTokenCount)],
        ]);
      }

      printDivider();
      printTable([
        ["Total sections size", formatBytes(totalSectionBytes)],
        ["Total assets size", formatBytes(totalAssetBytes)],
        ["Combined", formatBytes(totalSectionBytes + totalAssetBytes)],
        ["Total packed tokens", formatNumber(totalTokens)],
        ["Total output tokens", formatNumber(totalOutputTokens)],
      ]);
      printDivider();
      printSuccess("Bundle created successfully");
    }

    if (args.json ?? false) {
      writeJson({
        projectName: plan.projectName,
        bundleDir: plan.bundleDir,
        manifestName: `${plan.projectName}-manifest.json`,
        checksumFile: plan.checksumFile,
        bundleIndexFile,
        sections: sectionOutputs,
        sectionCount: plan.sections.length,
        assetCount: plan.assets.length,
        unmatchedCount: plan.unmatchedFiles.length,
        statistics: {
          totalSectionBytes,
          totalAssetBytes,
          totalBytes: totalSectionBytes + totalAssetBytes,
          totalPackedTokens: totalTokens,
          totalOutputTokens,
        },
        warnings: [...plan.warnings, ...renderWarnings],
        repomix: await getRepomixCapabilities(),
      });
    }
  } finally {
    if (stagingRoot) {
      await fs.rm(stagingRoot, { recursive: true, force: true });
    }
  }
  return 0;
}
