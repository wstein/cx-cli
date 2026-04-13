import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { relativePosix, sortLexically } from "../shared/fs.js";
import type { VCSState } from "./provider.js";

const execFileAsync = promisify(execFile);

/**
 * Execute a git command with consistent options.
 */
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

/**
 * Detect if the given path is inside a Git repository.
 *
 * `git rev-parse --git-dir` succeeds from any directory inside a work tree,
 * including subdirectories of the repository root.
 */
export async function detectGit(sourceRoot: string): Promise<boolean> {
  try {
    await runGit(["rev-parse", "--git-dir"], sourceRoot);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract the current Git working-tree state.
 *
 * @returns VCSState with kind="git" containing tracked, modified, and untracked files.
 */
export async function getGitState(sourceRoot: string): Promise<VCSState> {
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
