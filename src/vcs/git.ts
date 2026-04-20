import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { RepositoryHistoryEntry } from "../render/handover.js";
import { sortLexically } from "../shared/fs.js";
import type { VCSState } from "./provider.js";

const execFileAsync = promisify(execFile);

type GitRunner = (args: string[], cwd: string) => Promise<{ stdout: string }>;

export interface GitHistoryEntry extends RepositoryHistoryEntry {
  hash: string;
  shortHash: string;
}

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
export async function detectGit(
  sourceRoot: string,
  run: GitRunner = runGit,
): Promise<boolean> {
  try {
    await run(["rev-parse", "--git-dir"], sourceRoot);
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
export async function getGitState(
  sourceRoot: string,
  run: GitRunner = runGit,
): Promise<VCSState> {
  // Null-delimited output is safe against filenames with newlines or spaces.
  const { stdout: lsOut } = await run(
    ["ls-files", "--cached", "-z"],
    sourceRoot,
  );
  const trackedFiles = sortLexically(lsOut.split("\0").filter(Boolean));

  // --no-renames keeps entries simple (one path per line, no rename pairs).
  // --porcelain=v1 is stable across git versions.
  const { stdout: statusOut } = await run(
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

const HISTORY_RECORD_SEPARATOR = "\u001e";
const HISTORY_FIELD_SEPARATOR = "\u001f";

export async function getRecentGitHistory(
  sourceRoot: string,
  count: number,
  run: GitRunner = runGit,
): Promise<GitHistoryEntry[]> {
  if (count <= 0) {
    return [];
  }

  const { stdout } = await run(
    [
      "log",
      `--max-count=${count}`,
      `--format=%H${HISTORY_FIELD_SEPARATOR}%B${HISTORY_RECORD_SEPARATOR}`,
      "--no-show-signature",
    ],
    sourceRoot,
  );

  return stdout
    .split(HISTORY_RECORD_SEPARATOR)
    .map((entry) => entry.replace(/\n+$/u, ""))
    .filter(Boolean)
    .map((entry) => {
      const separatorIndex = entry.indexOf(HISTORY_FIELD_SEPARATOR);
      if (separatorIndex === -1) {
        return null;
      }
      const hash = entry.slice(0, separatorIndex).trim();
      const message = entry.slice(separatorIndex + 1).replace(/\n+$/u, "");
      if (!hash || !message) {
        return null;
      }
      return {
        hash,
        shortHash: hash.slice(0, 12),
        message,
      } satisfies GitHistoryEntry;
    })
    .filter((entry): entry is GitHistoryEntry => entry !== null);
}
