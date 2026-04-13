import type { CxStyle } from "../config/types.js";
import type { DirtyState, VCSKind } from "../vcs/provider.js";

export interface PlannedSourceFile {
  relativePath: string;
  absolutePath: string;
  kind: "text" | "asset";
  mediaType: string;
  sizeBytes: number;
  sha256: string;
  mtime: string;
}

export interface PlannedSection {
  name: string;
  style: CxStyle;
  outputFile: string;
  files: PlannedSourceFile[];
}

export interface PlannedAsset extends PlannedSourceFile {
  storedPath: string;
}

export interface BundlePlan {
  projectName: string;
  sourceRoot: string;
  bundleDir: string;
  checksumFile: string;
  sections: PlannedSection[];
  assets: PlannedAsset[];
  unmatchedFiles: string[];
  /**
   * Non-fatal warnings emitted during planning.
   * Populated when Category B behavioral settings resolve to "warn" instead of
   * failing (e.g. dedup.mode="warn" on overlapping sections).
   * Commands that output --json include these in the response envelope.
   */
  warnings: string[];
  /** Which VCS was detected for this source root (or "none" for the filesystem fallback). */
  vcsKind: VCSKind;
  /**
   * Dirty-state classification of the working tree at planning time.
   *
   * The planner produces "clean", "safe_dirty", or "unsafe_dirty". The bundle
   * command resolves "unsafe_dirty" as either a fatal error or "forced_dirty"
   * (when --force is passed), and records the effective state in the manifest.
   */
  dirtyState: Exclude<DirtyState, "forced_dirty">;
  /**
   * Relative POSIX paths of VCS-tracked files with uncommitted local changes.
   * Populated only when dirtyState is "unsafe_dirty"; empty otherwise.
   */
  modifiedFiles: string[];
}
