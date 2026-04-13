import type { CxStyle } from "../config/types.js";
import type { DirtyState, VCSKind } from "../vcs/provider.js";

export const NORMALIZATION_POLICY = "repomix-default-v1" as const;

export interface ManifestSettings {
  globalStyle: CxStyle;
  tokenEncoding: string;
  showLineNumbers: boolean;
  includeEmptyDirectories: boolean;
  securityCheck: boolean;
  normalizationPolicy: typeof NORMALIZATION_POLICY;
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
}

/** A section as stored in the manifest, including its file list. */
export interface CxSection extends SectionOutputRecord {
  files: ManifestFileRow[];
}

export interface CxManifest {
  schemaVersion: 6;
  bundleVersion: 1;
  projectName: string;
  sourceRoot: string;
  bundleDir: string;
  checksumFile: string;
  bundleIndexFile?: string;
  createdAt: string;
  cxVersion: string;
  repomixVersion: string;
  checksumAlgorithm: "sha256";
  settings: ManifestSettings;
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
   *                  because the operator passed --force. The LLM must treat
   *                  this bundle as containing uncommitted work.
   */
  dirtyState: Exclude<DirtyState, "unsafe_dirty">;
  /**
   * Relative POSIX paths of VCS-tracked files that had uncommitted local
   * changes at bundle time. Populated only when dirtyState is "forced_dirty".
   */
  modifiedFiles: string[];
  sections: CxSection[];
  assets: AssetRecord[];
  /** Flat list of all file rows (text + asset), reconstructed after parsing. */
  files: ManifestFileRow[];
}
