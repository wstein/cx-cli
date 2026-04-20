import type { CxStyle } from "../config/types.js";
import type { NoteCognitionLabel, NoteTrustLevel } from "../notes/cognition.js";
import type { InclusionProvenance } from "../planning/types.js";
import type { DirtyState, VCSKind } from "../vcs/provider.js";

export const NORMALIZATION_POLICY = "repomix-default-v1" as const;

export interface ManifestSettings {
  globalStyle: CxStyle;
  tokenEncoding: string;
  showLineNumbers: boolean;
  includeEmptyDirectories: boolean;
  securityCheck: boolean;
  normalizationPolicy: typeof NORMALIZATION_POLICY;
  includeLinkedNotes?: boolean;
}

export interface ManifestFileRow {
  path: string;
  kind: "text" | "asset";
  section: string | "-";
  storedIn: "packed" | "copied";
  sha256: string;
  sizeBytes: number;
  tokenCount: number;
  mtime: string;
  mediaType: string;
  outputStartLine: number | null;
  outputEndLine: number | null;
  provenance?: InclusionProvenance[];
}

export interface SectionOutputRecord {
  name: string;
  style: CxStyle;
  outputFile: string;
  outputSha256: string;
  fileCount: number;
  tokenCount: number;
}

export interface FileSpanRecord {
  outputStartLine: number;
  outputEndLine: number;
}

export type FileSpanMap = Map<string, FileSpanRecord>;
export type SectionSpanMaps = Map<string, FileSpanMap>;
export type FileTokenMap = Map<string, number>;
export type SectionTokenMaps = Map<string, FileTokenMap>;
export type FileHashMap = Map<string, string>;
export type SectionHashMaps = Map<string, FileHashMap>;

export interface AssetRecord {
  sourcePath: string;
  storedPath: string;
  sha256: string;
  sizeBytes: number;
  mtime: string;
  mediaType: string;
  provenance?: InclusionProvenance[];
}

export interface NoteRecord {
  id: string;
  title: string;
  fileName: string;
  aliases: string[];
  tags: string[];
  summary: string;
  codeLinks: string[];
  cognitionScore: number;
  cognitionLabel: NoteCognitionLabel;
  trustLevel: NoteTrustLevel;
  lastModified: string;
}

export interface ManifestTrustModel {
  sourceTree: "trusted";
  notes: NoteTrustLevel;
  agentOutput: "untrusted_until_verified";
  bundle: "trusted";
}

export interface ManifestTraceability {
  bundle: {
    command: "cx bundle";
    track: "A";
  };
  notes: {
    governanceCommand: "cx notes check";
    trustLevel: NoteTrustLevel;
  };
  agent: {
    auditLogPath: ".cx/audit.log";
    outputTrust: "untrusted_until_verified";
    decisionSource: "mcp_audit_log";
  };
}

/** A section as stored in the manifest, including its file list. */
export interface CxSection extends SectionOutputRecord {
  files: ManifestFileRow[];
}

export interface CxManifest {
  schemaVersion: 8;
  bundleVersion: 1;
  projectName: string;
  sourceRoot: string;
  bundleDir: string;
  checksumFile: string;
  handoverFile?: string;
  createdAt: string;
  cxVersion: string;
  adapterVersion: string;
  checksumAlgorithm: "sha256";
  /**
   * Hash of the render plan (if structured rendering was used).
   * Provides integrity verification of the deterministic render contract.
   */
  renderPlanHash?: string;
  settings: ManifestSettings;
  /**
   * Total token count for the entire bundle (sum of all section tokens).
   */
  totalTokenCount: number;
  /**
   * VCS system detected at bundle time ("git", "fossil", or "none" for the
   * filesystem fallback).
   */
  vcsProvider: VCSKind;
  /**
   * Source-tree dirty state at bundle time.
   *
   * "clean"        — no working-tree modifications; standard verified bundle.
   * "safe_dirty"   — only untracked files were present; bundle integrity is
   *                  unaffected.
   * "forced_dirty" — tracked files with uncommitted changes were bundled
   *                  because the operator passed --force. For local
   *                  experimentation. The LLM must treat this bundle as
   *                  containing uncommitted work.
   * "ci_dirty"     — same as forced_dirty but triggered by a CI pipeline that
   *                  passed --ci. Recorded separately for audit traceability.
   */
  dirtyState: Exclude<DirtyState, "unsafe_dirty">;
  /**
   * Relative POSIX paths of VCS-tracked files that had uncommitted local
   * changes at bundle time. Populated when dirtyState is "forced_dirty" or
   * "ci_dirty".
   */
  modifiedFiles: string[];
  trustModel: ManifestTrustModel;
  traceability: ManifestTraceability;
  sections: CxSection[];
  assets: AssetRecord[];
  /** Flat list of all file rows (text + asset), reconstructed after parsing. */
  files: ManifestFileRow[];
  /** Repository notes metadata, if notes were present during bundling. */
  notes?: NoteRecord[];
}
