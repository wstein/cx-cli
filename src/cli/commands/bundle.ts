import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateBundle } from "../../bundle/validate.js";
import { getCLIOverrides, readEnvOverrides } from "../../config/env.js";
import { loadCxConfig } from "../../config/load.js";
import type { CxAssetsLayout, CxStyle } from "../../config/types.js";
import {
  DOCS_EXPORT_GENERATOR,
  exportAntoraDocsToMarkdown,
} from "../../docs/export.js";
import type { ScannerPipeline } from "../../doctor/scanner.js";
import { loadReferenceScannerPipeline } from "../../doctor/scanner.js";
import { buildManifest } from "../../manifest/build.js";
import { writeChecksumFile } from "../../manifest/checksums.js";
import { renderManifestJson } from "../../manifest/json.js";
import {
  type CxLockFile,
  lockFileName,
  writeLock,
} from "../../manifest/lock.js";
import type {
  DerivedReviewExportRecord,
  SectionHashMaps,
  SectionSpanMaps,
  SectionTokenMaps,
} from "../../manifest/types.js";
import { checkNotesConsistency } from "../../notes/consistency.js";
import { enrichPlanWithLinkedNotes } from "../../notes/planner.js";
import {
  type NoteFrontmatterConfig,
  validateNotes,
} from "../../notes/validate.js";
import { buildBundlePlan } from "../../planning/buildPlan.js";
import { summarizeInclusionProvenance } from "../../planning/provenance.js";
import { defaultRenderEngine } from "../../render/engine.js";
import type { RepositoryHistoryEntry } from "../../render/handover.js";
import { renderSharedHandover } from "../../render/handover.js";
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
import {
  type CommandIo,
  resolveCommandIo,
  writeStderr,
  writeValidatedJson,
} from "../../shared/output.js";
import { defaultTokenizerProvider } from "../../shared/tokenizer.js";
import { CX_VERSION } from "../../shared/version.js";
import { getRecentFossilHistory } from "../../vcs/fossil.js";
import { getRecentGitHistory } from "../../vcs/git.js";
import { getRecentHgHistory } from "../../vcs/mercurial.js";
import type { DirtyState, VCSKind } from "../../vcs/provider.js";
import { BundleCommandJsonSchema } from "../jsonContracts.js";

export interface BundleArgs {
  config: string;
  json?: boolean | undefined;
  layout?: CxAssetsLayout | undefined;
  docsRootLevel?: 0 | 1 | undefined;
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
  includeDocExports?: boolean | undefined;
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
  planHash?: string;
}

interface BundleCommandDeps {
  scannerPipeline?: ScannerPipeline;
  readFile?: typeof fs.readFile;
}

function normalizeRelativeNotePath(
  sourceRoot: string,
  filePath: string,
): string {
  return path.relative(sourceRoot, filePath).replaceAll("\\", "/");
}

function collectGatedNotePaths(params: {
  sourceRoot: string;
  plan: {
    sections: Array<{ name: string; files: Array<{ relativePath: string }> }>;
  };
  appliesToSections: string[];
}): Set<string> {
  const sectionFilter =
    params.appliesToSections.length > 0
      ? new Set(params.appliesToSections)
      : null;
  const notePaths = new Set<string>();

  for (const section of params.plan.sections) {
    if (sectionFilter !== null && !sectionFilter.has(section.name)) {
      continue;
    }

    for (const file of section.files) {
      if (file.relativePath.startsWith("notes/")) {
        notePaths.add(file.relativePath);
      }
    }
  }

  return notePaths;
}

async function enforceNotesGate(params: {
  config: {
    notes: {
      requireCognitionScore?: number;
      strictNotesMode: boolean;
      failOnDriftPressuredNotes: boolean;
      appliesToSections: string[];
      frontmatter: NoteFrontmatterConfig;
    };
  };
  plan: {
    sourceRoot: string;
    sections: Array<{ name: string; files: Array<{ relativePath: string }> }>;
  };
}): Promise<void> {
  const notesConfig = params.config.notes;
  if (
    notesConfig.requireCognitionScore === undefined &&
    !notesConfig.strictNotesMode &&
    !notesConfig.failOnDriftPressuredNotes
  ) {
    return;
  }

  const report = await checkNotesConsistency("notes", params.plan.sourceRoot, {
    frontmatter: notesConfig.frontmatter,
  });
  const gatedNotePaths = collectGatedNotePaths({
    sourceRoot: params.plan.sourceRoot,
    plan: params.plan,
    appliesToSections: notesConfig.appliesToSections,
  });

  const gatedNotes = report.evaluatedNotes.filter((note) =>
    gatedNotePaths.has(
      normalizeRelativeNotePath(params.plan.sourceRoot, note.filePath),
    ),
  );

  if (gatedNotes.length === 0) {
    return;
  }

  const requiredScore = notesConfig.requireCognitionScore;
  const thresholdFailures =
    requiredScore === undefined
      ? []
      : gatedNotes.filter((note) => note.score < requiredScore);
  const strictFailures = notesConfig.strictNotesMode
    ? gatedNotes.filter((note) => note.label !== "high_signal")
    : [];
  const driftFailures = notesConfig.failOnDriftPressuredNotes
    ? gatedNotes.filter((note) => note.driftWarningCount > 0)
    : [];

  if (
    thresholdFailures.length === 0 &&
    strictFailures.length === 0 &&
    driftFailures.length === 0
  ) {
    return;
  }

  const detailLines: string[] = [];
  if (thresholdFailures.length > 0) {
    detailLines.push(
      `Required note cognition score ${requiredScore} was not met by ${thresholdFailures.length} gated note(s):`,
    );
    for (const note of thresholdFailures) {
      detailLines.push(`- [${note.id}] ${note.title} (score ${note.score})`);
    }
  }
  if (strictFailures.length > 0) {
    detailLines.push(
      `strict_notes_mode requires gated notes to remain high-signal, but ${strictFailures.length} gated note(s) did not:`,
    );
    for (const note of strictFailures) {
      detailLines.push(
        `- [${note.id}] ${note.title} (${note.label}, score ${note.score})`,
      );
    }
  }
  if (driftFailures.length > 0) {
    detailLines.push(
      `fail_on_drift_pressured_notes rejects gated notes with note-to-code drift warnings, but ${driftFailures.length} gated note(s) were drift-pressured:`,
    );
    for (const note of driftFailures) {
      detailLines.push(
        `- [${note.id}] ${note.title} (drift warnings ${note.driftWarningCount})`,
      );
    }
  }

  throw new CxError(detailLines.join("\n"), 10, {
    remediation: {
      docsRef: "notes/Notes Gating Policy.md",
      whyThisProtectsYou:
        "Optional note gates keep high-assurance bundles from carrying weak or drift-pressured cognition into downstream agent workflows.",
      nextSteps: [
        "Strengthen the gated notes until they meet the configured cognition threshold.",
        "Lower or scope the notes gate only if the reduced assurance is intentional.",
        "Run `cx notes check` to inspect low-signal notes, drift warnings, and contradictions.",
      ],
    },
  });
}

async function collectScannerSourceFiles(params: {
  sourceRoot: string;
  plan: {
    sections: Array<{
      files: Array<{
        relativePath: string;
        absolutePath: string;
        kind: string;
      }>;
    }>;
  };
  readFile: typeof fs.readFile;
}): Promise<Array<{ path: string; content: string }>> {
  const files: Array<{ path: string; content: string }> = [];

  for (const section of params.plan.sections) {
    for (const file of section.files) {
      if (file.kind !== "text") {
        continue;
      }

      files.push({
        path: file.relativePath,
        content: await params.readFile(file.absolutePath, "utf8"),
      });
    }
  }

  return files;
}

async function enforceScannerPipeline(params: {
  config: {
    repomix: { securityCheck: boolean };
    scanner: {
      mode: "fail" | "warn";
      ids: "reference_secrets"[];
      includePostPackArtifacts: boolean;
    };
  };
  io: Partial<CommandIo>;
  scannerPipeline: ScannerPipeline | undefined;
  stage: "pre_pack_source" | "post_pack_artifact";
  files: Array<{ path: string; content: string }>;
}): Promise<string[]> {
  if (!params.config.repomix.securityCheck) {
    return [];
  }

  const scannerPipeline =
    params.scannerPipeline ?? (await loadReferenceScannerPipeline());
  const scanReport = await scannerPipeline.scanStage(
    params.stage,
    params.files,
    {
      mode: params.config.scanner.mode,
      enabledScannerIds: params.config.scanner.ids,
    },
  );

  if (scanReport.findings.length === 0) {
    return [];
  }

  const findingSummaries = scanReport.findings.map(
    (finding) =>
      `${finding.filePath} (${finding.stage}, ${finding.scannerId}, ${finding.severity}): ${finding.messages.join("; ")}`,
  );

  if (scanReport.blockingCount > 0) {
    throw new CxError(
      `Scanner pipeline blocked bundling with ${scanReport.blockingCount} finding(s).\n${findingSummaries.map((line) => `- ${line}`).join("\n")}`,
      10,
      {
        remediation: {
          docsRef: "notes/Scanner Pipeline Contract.md",
          whyThisProtectsYou:
            "Core scanners protect the proof path from shipping known-sensitive content inside a bundle.",
          nextSteps: [
            "Remove or rotate the flagged secret material, then rerun cx bundle.",
            'Set scanner.mode = "warn" only when the reduced enforcement is intentional.',
            "Run `cx doctor secrets --config cx.toml` to review the scanner findings directly.",
          ],
        },
      },
    );
  }

  const warnings = findingSummaries.map((line) => `Scanner warning: ${line}`);
  for (const warning of warnings) {
    writeStderr(`Warning: ${warning}\n`, params.io);
  }
  return warnings;
}

async function collectScannerArtifactFiles(params: {
  bundleDir: string;
  sectionOutputFiles: string[];
  handoverFile: string;
  manifestName: string;
  derivedReviewExportFiles?: string[] | undefined;
  readFile: typeof fs.readFile;
}): Promise<Array<{ path: string; content: string }>> {
  const artifactPaths = [
    ...params.sectionOutputFiles,
    params.handoverFile,
    params.manifestName,
    ...(params.derivedReviewExportFiles ?? []),
  ];

  return Promise.all(
    artifactPaths.map(async (artifactPath) => ({
      path: artifactPath,
      content: await params.readFile(
        path.join(params.bundleDir, artifactPath),
        "utf8",
      ),
    })),
  );
}

function docsExportDirectoryName(targetDir: string): string {
  return targetDir;
}

export async function collectSharedHandoverRepoHistory(params: {
  includeRepoHistory: boolean;
  repoHistoryCount: number;
  vcsKind: VCSKind;
  sourceRoot: string;
  emitWarning: (message: string) => void;
  historyLoaders?: Partial<
    Record<
      Exclude<VCSKind, "none">,
      (sourceRoot: string, count: number) => Promise<RepositoryHistoryEntry[]>
    >
  >;
}): Promise<RepositoryHistoryEntry[]> {
  const historyLoaders = {
    git: getRecentGitHistory,
    hg: getRecentHgHistory,
    fossil: getRecentFossilHistory,
    ...(params.historyLoaders ?? {}),
  };

  if (!params.includeRepoHistory || params.vcsKind === "none") {
    return [];
  }

  const historyLoader = historyLoaders[params.vcsKind];
  if (!historyLoader) {
    return [];
  }

  try {
    return await historyLoader(params.sourceRoot, params.repoHistoryCount);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    params.emitWarning(
      `failed to collect recent repository history for shared handover: ${message}`,
    );
    return [];
  }
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

export async function runBundleCommand(
  args: BundleArgs,
  ioArg: Partial<CommandIo> = {},
  deps: BundleCommandDeps = {},
): Promise<number> {
  const io = resolveCommandIo(ioArg);
  const config = await loadCxConfig(
    args.config,
    readEnvOverrides(io.env),
    {
      ...getCLIOverrides(),
      ...(args.layout !== undefined && { assetsLayout: args.layout }),
    },
    {
      emitBehaviorLogs: io.emitBehaviorLogs,
    },
  );
  const plan = await enrichPlanWithLinkedNotes(
    await buildBundlePlan(config, {
      emitWarning: (message) => writeStderr(`Warning: ${message}\n`, io),
    }),
    config,
  );

  // Validate notes in the source directory
  const notesResult = await validateNotes("notes", plan.sourceRoot, {
    frontmatter: config.notes.frontmatter,
  });
  if (!notesResult.valid) {
    if (notesResult.errors.length > 0) {
      printWarning("Note validation errors:", io);
      for (const error of notesResult.errors) {
        writeStderr(`  ${error.filePath}: ${error.error}\n`, io);
      }
    }
    if (notesResult.duplicateIds.length > 0) {
      printWarning("Duplicate note IDs detected:", io);
      for (const { id, files } of notesResult.duplicateIds) {
        writeStderr(`  ID ${id}: ${files.join(", ")}\n`, io);
      }
    }
    throw new CxError("Note validation failed", 10, {
      remediation: {
        docsRef:
          "docs/modules/ROOT/pages/repository/docs/governance.adoc#notes-governance",
        whyThisProtectsYou:
          "The notes graph is the repository cognition layer. Refusing low-signal or malformed notes keeps bundles and agent workflows anchored to durable knowledge instead of noisy context.",
        nextSteps: [
          "Fix the reported note validation errors or duplicate IDs.",
          "Run `cx notes check` to review governance failures, graph issues, and note drift before bundling again.",
        ],
      },
    });
  }
  await enforceNotesGate({ config, plan });
  const scannerWarnings = await enforceScannerPipeline({
    config,
    io,
    stage: "pre_pack_source",
    files: await collectScannerSourceFiles({
      sourceRoot: plan.sourceRoot,
      plan,
      readFile: deps.readFile ?? fs.readFile,
    }),
    scannerPipeline: deps.scannerPipeline,
  });

  const ciMode = args.ci ?? false;
  const forceMode = args.force ?? false;
  const tokenizer = defaultTokenizerProvider;

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
        `Refusing to bundle: ${plan.modifiedFiles.length} VCS-tracked file(s) have uncommitted changes: ${listed}${more}.`,
        7,
        {
          remediation: {
            docsRef: "docs/modules/architecture/pages/mental-model.adoc",
            whyThisProtectsYou:
              "A bundle built from tracked-file drift cannot later be verified against a committed source tree, which breaks the artifact contract for reviewers, CI, and handoff automation.",
            nextSteps: [
              "Commit or stash the tracked changes, then rerun cx bundle.",
              "Use --force for a local override or --ci for a pipeline override only when you intend to record dirty provenance in the manifest.",
            ],
          },
        },
      );
    }
    const recordedState = ciMode ? "ci_dirty" : "forced_dirty";
    writeStderr(
      `Warning: bundling with uncommitted changes in ${plan.modifiedFiles.length} file(s). The manifest will record dirty state as '${recordedState}'.\n`,
      io,
    );
  } else if (plan.dirtyState === "safe_dirty") {
    writeStderr(
      "Note: working tree has untracked files. These are outside the VCS master list and do not affect bundle integrity (safe_dirty). Use files.include to explicitly pull untracked files into the plan.\n",
      io,
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
    const provenanceSummary = summarizeInclusionProvenance([
      ...plan.sections.flatMap((section) => section.files),
      ...plan.assets,
    ]);
    const repoHistory = await collectSharedHandoverRepoHistory({
      includeRepoHistory: config.handover.includeRepoHistory,
      repoHistoryCount: config.handover.repoHistoryCount,
      vcsKind: plan.vcsKind,
      sourceRoot: plan.sourceRoot,
      emitWarning: (message) => writeStderr(`Warning: ${message}\n`, io),
    });

    await Promise.all(
      plan.assets.map(async (asset) => {
        const destination = path.join(activeBundleDir, asset.storedPath);
        await ensureDir(path.dirname(destination));
        await fs.copyFile(asset.absolutePath, destination);
      }),
    );

    const handoverFile = `${plan.projectName}-handover${config.output.extensions[config.repomix.style]}`;
    const renderedSections: RenderedSectionArtifacts[] = await Promise.all(
      plan.sections.map(async (section) => {
        const outputPath = path.join(activeBundleDir, section.outputFile);
        const renderResult = await defaultRenderEngine.renderSection({
          config,
          style: section.style,
          sourceRoot: plan.sourceRoot,
          outputPath,
          sectionName: section.name,
          explicitFiles: section.files.map((file) => file.absolutePath),
          handoverFile,
          requireStructured: true,
          requireOutputSpans: requiresOutputSpans,
          io,
        });

        const totalSectionBytes = section.files.reduce(
          (sum, file) => sum + file.sizeBytes,
          0,
        );
        const outputTokenCount = tokenizer.countTokens(
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
          ...(renderResult.planHash !== undefined
            ? { planHash: renderResult.planHash }
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
    const sectionPlanHashes = new Map<string, string>();
    const renderWarnings: string[] = [];

    for (const section of renderedSections) {
      renderWarnings.push(...section.warnings);
      sectionTokenMaps.set(section.name, section.fileTokenCounts);
      sectionHashMaps.set(section.name, section.fileContentHashes);
      if (section.fileSpans) {
        sectionSpanMaps.set(section.name, section.fileSpans);
      }
      if (section.planHash) {
        sectionPlanHashes.set(section.name, section.planHash);
      }
    }

    const derivedReviewExports: DerivedReviewExportRecord[] | undefined =
      args.includeDocExports === true
        ? (
            await exportAntoraDocsToMarkdown({
              workspaceRoot: plan.sourceRoot,
              outputDir: path.join(
                activeBundleDir,
                docsExportDirectoryName(config.docs.targetDir),
              ),
              format: "multimarkdown",
              extension: ".mmd.txt",
              rootLevel: args.docsRootLevel ?? config.docs.rootLevel,
              logOutput: path.join(activeBundleDir, "antora-export.log.txt"),
            })
          ).map((artifact) => ({
            assemblyName: artifact.assemblyName,
            title: artifact.title,
            moduleName: artifact.moduleName,
            storedPath: path
              .join(
                docsExportDirectoryName(config.docs.targetDir),
                artifact.outputFile,
              )
              .replaceAll("\\", "/"),
            sha256: artifact.sha256,
            sizeBytes: artifact.sizeBytes,
            pageCount: artifact.pageCount,
            rootLevel: artifact.rootLevel,
            sourcePaths: [...artifact.sourcePaths],
            generator: {
              ...DOCS_EXPORT_GENERATOR,
              extension: ".mmd.txt",
            },
            trustClassification: "derived_review_export",
          }))
        : undefined;

    await fs.writeFile(
      path.join(activeBundleDir, handoverFile),
      renderSharedHandover({
        style: config.repomix.style,
        projectName: plan.projectName,
        sectionOutputs,
        assetPaths: plan.assets.map((asset) => ({
          sourcePath: asset.relativePath,
          storedPath: asset.storedPath,
        })),
        derivedReviewExports: (derivedReviewExports ?? []).map((artifact) => ({
          assemblyName: artifact.assemblyName,
          storedPath: artifact.storedPath,
          moduleName: artifact.moduleName,
          pageCount: artifact.pageCount,
          rootLevel: artifact.rootLevel,
        })),
        provenanceSummary,
        repoHistory,
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
            codeLinks: note.codeLinks,
            cognitionScore: note.cognition.score,
            cognitionLabel: note.cognition.label,
            trustLevel: note.cognition.trustLevel,
            lastModified: new Date().toISOString(),
          }))
        : undefined;

    const manifest = await buildManifest({
      config,
      plan,
      sectionOutputs,
      handoverFile,
      cxVersion: CX_VERSION,
      sectionSpanMaps,
      sectionTokenMaps,
      sectionHashMaps,
      sectionPlanHashes,
      dirtyState: effectiveDirtyState,
      modifiedFiles: effectiveModifiedFiles,
      notes: notesRecords,
      derivedReviewExports,
    });
    const manifestName = `${plan.projectName}-manifest.json`;
    await fs.writeFile(
      path.join(activeBundleDir, manifestName),
      renderManifestJson(manifest, config.manifest.pretty),
      "utf8",
    );

    const postPackScannerWarnings = config.scanner.includePostPackArtifacts
      ? await enforceScannerPipeline({
          config,
          io,
          stage: "post_pack_artifact",
          files: await collectScannerArtifactFiles({
            bundleDir: activeBundleDir,
            sectionOutputFiles: plan.sections.map(
              (section) => section.outputFile,
            ),
            handoverFile,
            manifestName,
            derivedReviewExportFiles: derivedReviewExports?.map(
              (artifact) => artifact.storedPath,
            ),
            readFile: deps.readFile ?? fs.readFile,
          }),
          scannerPipeline: deps.scannerPipeline,
        })
      : [];

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
      handoverFile,
      ...plan.sections.map((section) => section.outputFile),
      ...plan.assets.map((asset) => asset.storedPath),
      ...(derivedReviewExports?.map((artifact) => artifact.storedPath) ?? []),
      plan.checksumFile,
    ];

    await writeChecksumFile(activeBundleDir, plan.checksumFile, [
      manifestName,
      lockFileName(plan.projectName),
      handoverFile,
      ...plan.sections.map((section) => section.outputFile),
      ...plan.assets.map((asset) => asset.storedPath),
      ...(derivedReviewExports?.map((artifact) => artifact.storedPath) ?? []),
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
      printHeader("Bundle Summary", io);
      printTable(
        [
          ["Project", plan.projectName],
          ["Location", plan.bundleDir],
          ["Shared handover", handoverFile],
          ["Docs review exports", derivedReviewExports?.length ?? 0],
        ],
        io,
      );
      printTable(
        [
          ["Mode", "Immutable snapshot"],
          ["Use MCP", "For live workspace exploration and note updates"],
        ],
        io,
      );
      printDivider(io);
      printTable(
        [
          ["Sections", plan.sections.length],
          ["Assets", plan.assets.length],
          ["Unmatched files", plan.unmatchedFiles.length],
        ],
        io,
      );
      printDivider(io);

      // Section details
      printSubheader("Sections", io);
      for (const section of sectionOutputs) {
        printTable(
          [
            [`  ${section.name}`, ""],
            ["    Files", section.fileCount],
            ["    Size", formatBytes(section.sizeBytes)],
            ["    Packed tokens", formatNumber(section.tokenCount)],
            ["    Output tokens", formatNumber(section.outputTokenCount)],
          ],
          io,
        );
      }

      if (provenanceSummary.length > 0) {
        printDivider(io);
        printSubheader("Inclusion Provenance", io);
        printTable(
          provenanceSummary.map((entry) => [
            `  ${entry.marker}`,
            `${formatNumber(entry.count)} path${entry.count === 1 ? "" : "s"}`,
          ]),
          io,
        );
      }

      printDivider(io);
      printTable(
        [
          ["Total sections size", formatBytes(totalSectionBytes)],
          ["Total assets size", formatBytes(totalAssetBytes)],
          ["Combined", formatBytes(totalSectionBytes + totalAssetBytes)],
          ["Total packed tokens", formatNumber(totalTokens)],
          ["Total output tokens", formatNumber(totalOutputTokens)],
        ],
        io,
      );
      printDivider(io);
      printSuccess("Bundle created successfully", io);
    }

    if (args.json ?? false) {
      const dirtyStateNote =
        effectiveDirtyState === "clean"
          ? "Working tree is clean."
          : effectiveDirtyState === "safe_dirty"
            ? "Untracked files present but outside VCS master list — bundle integrity is unaffected."
            : effectiveDirtyState === "forced_dirty"
              ? "Bundle produced with uncommitted tracked changes (--force override)."
              : "Bundle produced with uncommitted tracked changes (--ci override).";
      writeValidatedJson(
        BundleCommandJsonSchema,
        {
          projectName: plan.projectName,
          bundleDir: plan.bundleDir,
          manifestName: `${plan.projectName}-manifest.json`,
          checksumFile: plan.checksumFile,
          handoverFile,
          sections: sectionOutputs,
          sectionCount: plan.sections.length,
          assetCount: plan.assets.length,
          derivedReviewExports: derivedReviewExports ?? [],
          unmatchedCount: plan.unmatchedFiles.length,
          dirtyState: effectiveDirtyState,
          dirtyStateNote,
          statistics: {
            totalSectionBytes,
            totalAssetBytes,
            totalBytes: totalSectionBytes + totalAssetBytes,
            totalPackedTokens: totalTokens,
            totalOutputTokens,
          },
          warnings: [
            ...plan.warnings,
            ...scannerWarnings,
            ...postPackScannerWarnings,
            ...renderWarnings,
          ],
        },
        io,
      );
    }
  } finally {
    if (stagingRoot) {
      await fs.rm(stagingRoot, { recursive: true, force: true });
    }
  }
  return 0;
}
