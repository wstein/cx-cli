import { getFilesystemState } from "./fallback.js";
import { detectFossil, getFossilState } from "./fossil.js";
import { detectGit, getGitState } from "./git.js";
import { detectHg, getHgState } from "./mercurial.js";

/**
 * The version-control system detected for a given source root.
 *
 * - "git"    — a Git repository was detected and git(1) is available.
 * - "fossil" — a Fossil repository was detected and fossil(1) is available.
 * - "hg"     — a Mercurial repository was detected and hg(1) is available.
 * - "none"   — no supported VCS was found; the pipeline falls back to a full
 *              filesystem traversal and treats every file as tracked.
 */
export type VCSKind = "git" | "fossil" | "hg" | "none";

/**
 * Dirty-state taxonomy for the source tree at bundle time.
 *
 * clean        — VCS state matches the last commit exactly; zero working-tree
 *                modifications. The bundle is a standard verified artifact.
 * safe_dirty   — Only untracked files are present in the working tree. No
 *                tracked file is modified or staged. Bundle integrity is not
 *                affected because untracked files are outside the VCS master
 *                list unless explicitly added via `[files] include`.
 * unsafe_dirty — One or more VCS-tracked files carry uncommitted local
 *                changes. The pipeline fails fast by default to prevent silent
 *                artifact drift. Pass `--force` to override.
 * forced_dirty — The operator explicitly passed `--force` to bypass the
 *                unsafe-dirty guard. The manifest records this state and the
 *                list of modified files so the LLM knows it is reading
 *                uncommitted work.
 */
export type DirtyState =
  | "clean"
  | "safe_dirty"
  | "unsafe_dirty"
  | "forced_dirty";

/**
 * Working-tree snapshot returned by the VCS provider.
 *
 * All paths are relative POSIX paths with respect to `sourceRoot`.
 */
export interface VCSState {
  /** Which VCS was detected, or "none" for the filesystem fallback. */
  kind: VCSKind;
  /** All files currently tracked by the VCS (or all files on disk when kind is "none"). */
  trackedFiles: string[];
  /** Tracked files that have uncommitted local modifications. Empty when kind is "none". */
  modifiedFiles: string[];
  /** Files present on disk but not tracked by the VCS. Empty when kind is "none". */
  untrackedFiles: string[];
}

/**
 * Detect the VCS in use at `sourceRoot` and return the current working-tree state.
 *
 * Precedence: Git → Fossil → Mercurial → filesystem fallback.
 *
 * The filesystem fallback is used when no supported VCS is detected or the
 * corresponding CLI tool is not installed (e.g. CI tarball environments without
 * a `.git` directory). In that case every file on disk is treated as tracked
 * and the dirty state is always "clean".
 */
export async function getVCSState(sourceRoot: string): Promise<VCSState> {
  // Try Git: `rev-parse --git-dir` succeeds from any directory inside a
  // work tree, including subdirectories of the repository root.
  if (await detectGit(sourceRoot)) {
    return await getGitState(sourceRoot);
  }

  // Try Fossil: `info` exits 0 only from inside a checked-out repository.
  if (await detectFossil(sourceRoot)) {
    return await getFossilState(sourceRoot);
  }

  // Try Mercurial: `identify` exits 0 when inside a Mercurial repository.
  if (await detectHg(sourceRoot)) {
    return await getHgState(sourceRoot);
  }

  // No VCS detected — fall back to full filesystem traversal.
  return getFilesystemState(sourceRoot);
}

/**
 * Classify the working-tree dirty state from a `VCSState` snapshot.
 *
 * Returns one of "clean" | "safe_dirty" | "unsafe_dirty". The "forced_dirty"
 * value is not produced here — it is applied by the bundle command when the
 * operator explicitly passes `--force` to bypass an unsafe-dirty rejection.
 */
export function classifyDirtyState(
  vcsState: VCSState,
): "clean" | "safe_dirty" | "unsafe_dirty" {
  if (vcsState.kind === "none") {
    // No VCS detected: dirty-state enforcement is meaningless, treat as clean.
    return "clean";
  }
  if (vcsState.modifiedFiles.length > 0) {
    return "unsafe_dirty";
  }
  if (vcsState.untrackedFiles.length > 0) {
    return "safe_dirty";
  }
  return "clean";
}
