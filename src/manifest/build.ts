import fs from "node:fs/promises";
import path from "node:path";
import type { CxConfig } from "../config/types.js";
import type { BundlePlan } from "../planning/types.js";
import { computeAggregatePlanHash } from "../render/planHash.js";
import { sha256NormalizedText } from "../shared/hashing.js";
import type { DirtyState } from "../vcs/provider.js";
import { MANIFEST_SCHEMA_VERSION } from "./json.js";
import type {
  CxManifest,
  CxSection,
  ManifestFileRow,
  ManifestTraceability,
  ManifestTrustModel,
  NoteRecord,
  SectionHashMaps,
  SectionOutputRecord,
  SectionSpanMaps,
  SectionTokenMaps,
} from "./types.js";
import { NORMALIZATION_POLICY } from "./types.js";

export async function buildManifest(params: {
  config: CxConfig;
  plan: BundlePlan;
  sectionOutputs: SectionOutputRecord[];
  handoverFile?: string | undefined;
  cxVersion: string;
  sectionSpanMaps?: SectionSpanMaps | undefined;
  sectionTokenMaps?: SectionTokenMaps | undefined;
  sectionHashMaps?: SectionHashMaps | undefined;
  /** Section render plan hashes (if structured rendering was used). */
  sectionPlanHashes?: Map<string, string> | undefined;
  /**
   * Effective dirty state to record in the manifest.
   *
   * The planner produces "clean", "safe_dirty", or "unsafe_dirty". The bundle
   * command promotes "unsafe_dirty" to "forced_dirty" (--force) or "ci_dirty"
   * (--ci) when the operator explicitly acknowledges the risk.
   */
  dirtyState: Exclude<DirtyState, "unsafe_dirty">;
  /** Relative POSIX paths of modified tracked files. Populated when dirtyState is "forced_dirty" or "ci_dirty". */
  modifiedFiles: string[];
  /** Repository notes metadata, if present. */
  notes?: NoteRecord[] | undefined;
}): Promise<CxManifest> {
  const sections: CxSection[] = await Promise.all(
    params.sectionOutputs.map(async (sectionOutput) => {
      const planSection = params.plan.sections.find(
        (s) => s.name === sectionOutput.name,
      );
      const sectionSpans = params.sectionSpanMaps?.get(sectionOutput.name);
      const sectionTokens = params.sectionTokenMaps?.get(sectionOutput.name);
      const sectionHashes = params.sectionHashMaps?.get(sectionOutput.name);
      const files: ManifestFileRow[] = await Promise.all(
        (planSection?.files ?? []).map(async (file) => {
          const fileSpan = sectionSpans?.get(file.relativePath);
          let fileHash = sectionHashes?.get(file.relativePath);

          if (fileHash === undefined) {
            const sourceFilePath = path.join(
              params.plan.sourceRoot,
              file.relativePath,
            );
            try {
              const sourceContents = await fs.readFile(sourceFilePath, "utf8");
              fileHash = sha256NormalizedText(sourceContents);
            } catch {
              throw new Error(
                `Missing normalized content hash for ${sectionOutput.name}/${file.relativePath}.`,
              );
            }
          }

          return {
            path: file.relativePath,
            kind: "text",
            section: sectionOutput.name,
            storedIn: "packed",
            sha256: fileHash,
            sizeBytes: file.sizeBytes,
            tokenCount: sectionTokens?.get(file.relativePath) ?? 0,
            mtime: file.mtime,
            mediaType: file.mediaType,
            outputStartLine: fileSpan?.outputStartLine ?? null,
            outputEndLine: fileSpan?.outputEndLine ?? null,
            provenance: file.provenance,
          };
        }),
      );
      return { ...sectionOutput, files };
    }),
  );

  const totalTokenCount = sections.reduce(
    (acc, section) => acc + section.tokenCount,
    0,
  );

  const textRows = sections.flatMap((s) => s.files);

  const assetRows: ManifestFileRow[] = params.plan.assets.map((asset) => ({
    path: asset.relativePath,
    kind: "asset",
    section: "-",
    storedIn: "copied",
    sha256: asset.sha256,
    sizeBytes: asset.sizeBytes,
    tokenCount: 0,
    mtime: asset.mtime,
    mediaType: asset.mediaType,
    outputStartLine: null,
    outputEndLine: null,
    provenance: asset.provenance,
  }));

  // Compute aggregate render plan hash from all section hashes
  const aggregatePlanHash = params.sectionPlanHashes
    ? computeAggregatePlanHash(params.sectionPlanHashes)
    : undefined;

  const manifest: CxManifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    bundleVersion: 1,
    projectName: params.plan.projectName,
    sourceRoot: params.plan.sourceRoot,
    bundleDir: params.plan.bundleDir,
    checksumFile: params.plan.checksumFile,
    createdAt: new Date().toISOString(),
    cxVersion: params.cxVersion,
    checksumAlgorithm: "sha256",
    ...(aggregatePlanHash ? { renderPlanHash: aggregatePlanHash } : {}),
    settings: {
      globalStyle: params.config.repomix.style,
      tokenEncoding: params.config.tokens.encoding,
      showLineNumbers: params.config.repomix.showLineNumbers,
      includeEmptyDirectories: params.config.repomix.includeEmptyDirectories,
      securityCheck: params.config.repomix.securityCheck,
      normalizationPolicy: NORMALIZATION_POLICY,
      includeLinkedNotes: params.config.manifest.includeLinkedNotes ?? false,
    },
    totalTokenCount,
    vcsProvider: params.plan.vcsKind,
    dirtyState: params.dirtyState,
    modifiedFiles: params.modifiedFiles,
    trustModel: {
      sourceTree: "trusted",
      notes: "conditional",
      agentOutput: "untrusted_until_verified",
      bundle: "trusted",
    } satisfies ManifestTrustModel,
    traceability: {
      bundle: {
        command: "cx bundle",
        track: "A",
      },
      notes: {
        governanceCommand: "cx notes check",
        trustLevel: "conditional",
      },
      agent: {
        auditLogPath: ".cx/audit.log",
        outputTrust: "untrusted_until_verified",
        decisionSource: "mcp_audit_log",
      },
    } satisfies ManifestTraceability,
    sections,
    assets: params.plan.assets.map((asset) => ({
      sourcePath: asset.relativePath,
      storedPath: asset.storedPath,
      sha256: asset.sha256,
      sizeBytes: asset.sizeBytes,
      mtime: asset.mtime,
      mediaType: asset.mediaType,
      provenance: asset.provenance,
    })),
    files: [...textRows, ...assetRows].sort((left, right) =>
      left.path.localeCompare(right.path, "en"),
    ),
  };

  if (params.handoverFile !== undefined) {
    manifest.handoverFile = params.handoverFile;
  }

  if (params.notes !== undefined && params.notes.length > 0) {
    manifest.notes = params.notes;
  }

  return manifest;
}
