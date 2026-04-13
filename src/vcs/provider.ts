import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import {
  listFilesRecursive,
  relativePosix,
  sortLexically,
} from "../shared/fs.js";

const execFileAsync = promisify(execFile);

/**
 * The version-control system detected for a given source root.
 *
 * - "git"    — a Git repository was detected and git(1) is available.
 * - "fossil" — a Fossil repository was detected and fossil(1) is available.
 * - "none"   — no supported VCS was found; the pipeline falls back to a full
 *              filesystem traversal and treats every file as tracked.
 */
export type VCSKind = "git" | "fossil" | "none";

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

// ---------------------------------------------------------------------------
// Git implementation
// ---------------------------------------------------------------------------

async function runGit(
  args: string[],
  cwd: string,
): Promise<{ stdout: string }> {
  return execFileAsync("git", args, {
    cwd,
    maxBuffer: 100 * 1024 * 1024,
    env: {
      ...process.env,
      // Disable interactive prompts and pagers so the process never blocks.
      GIT_TERMINAL_PROMPT: "0",
      GIT_PAGER: "cat",
    },
  });
}

async function getGitState(sourceRoot: string): Promise<VCSState> {
  // Null-delimited output is safe against filenames with newlines or spaces.
  const { stdout: lsOut } = await runGit(
    ["ls-files", "--cached", "-z"],
    sourceRoot,
  );
  const trackedFiles = sortLexically(lsOut.split("\0").filter(Boolean));

  // --no-renames keeps entries simple (one path per line, no rename pairs).
  // --porcelain=v1 is stable across git versions.
  const { stdout: statusOut } = await runGit(
    ["status", "--porcelain=v1", "--no-renames"],
    sourceRoot,
  );

  const modifiedFiles: string[] = [];
  const untrackedFiles: string[] = [];

  for (const line of statusOut.split("\n")) {
    if (line.length < 4) continue;
    const xy = line.slice(0, 2);
    const filePath = line.slice(3).trimEnd();
    if (!filePath) continue;

    if (xy === "??") {
      untrackedFiles.push(filePath);
    } else {
      modifiedFiles.push(filePath);
    }
  }

  return {
    kind: "git",
    trackedFiles,
    modifiedFiles: sortLexically(modifiedFiles),
    untrackedFiles: sortLexically(untrackedFiles),
  };
}

// ---------------------------------------------------------------------------
// Fossil implementation
// ---------------------------------------------------------------------------

async function runFossil(
  args: string[],
  cwd: string,
): Promise<{ stdout: string }> {
  return execFileAsync("fossil", args, {
    cwd,
    maxBuffer: 100 * 1024 * 1024,
  });
}

async function getFossilState(sourceRoot: string): Promise<VCSState> {
  const { stdout: lsOut } = await runFossil(["ls"], sourceRoot);
  const trackedFiles = sortLexically(
    lsOut
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  );

  // `fossil status` prints one "STATUS   path" line per changed or extra file.
  // Lines with status EXTRA are untracked; all other non-UNCHANGED statuses
  // represent tracked files with local modifications.
  const { stdout: statusOut } = await runFossil(["status"], sourceRoot).catch(
    () => ({ stdout: "" }),
  );

  const modifiedFiles: string[] = [];
  const untrackedFiles: string[] = [];

  for (const line of statusOut.split("\n")) {
    const match = /^([A-Z_]+)\s+(.+)$/i.exec(line.trim());
    if (!match) continue;
    const [, status, filePath] = match;
    if (status === "EXTRA") {
      untrackedFiles.push(filePath as string);
    } else if (status !== "UNCHANGED") {
      modifiedFiles.push(filePath as string);
    }
  }

  return {
    kind: "fossil",
    trackedFiles,
    modifiedFiles: sortLexically(modifiedFiles),
    untrackedFiles: sortLexically(untrackedFiles),
  };
}

// ---------------------------------------------------------------------------
// Filesystem fallback
// ---------------------------------------------------------------------------

async function getFilesystemState(sourceRoot: string): Promise<VCSState> {
  const absoluteFiles = await listFilesRecursive(sourceRoot);
  return {
    kind: "none",
    trackedFiles: sortLexically(
      absoluteFiles.map((abs) => relativePosix(sourceRoot, abs)),
    ),
    modifiedFiles: [],
    untrackedFiles: [],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect the VCS in use at `sourceRoot` and return the current working-tree
 * state.
 *
 * Precedence: Git → Fossil → filesystem fallback.
 *
 * The filesystem fallback is used when no supported VCS is detected or the
 * corresponding CLI tool is not installed (e.g. CI tarball environments without
 * a `.git` directory). In that case every file on disk is treated as tracked
 * and the dirty state is always "clean".
 */
export async function getVCSState(sourceRoot: string): Promise<VCSState> {
  // Try Git: `rev-parse --git-dir` succeeds from any directory inside a
  // work tree, including subdirectories of the repository root.
  try {
    await runGit(["rev-parse", "--git-dir"], sourceRoot);
    return await getGitState(sourceRoot);
  } catch {
    // Not a Git repository, or git is not available.
  }

  // Try Fossil: `info` exits 0 only from inside a checked-out repository.
  try {
    await runFossil(["info", "--quiet"], sourceRoot);
    return await getFossilState(sourceRoot);
  } catch {
    // Not a Fossil repository, or fossil is not available.
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
