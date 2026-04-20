import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { RepositoryHistoryEntry } from "../render/handover.js";
import { sortLexically } from "../shared/fs.js";
import type { VCSState } from "./provider.js";

const execFileAsync = promisify(execFile);

type HgRunner = (args: string[], cwd: string) => Promise<{ stdout: string }>;
const DEFAULT_HISTORY_SUBJECT_LIMIT = 120;

export interface HgHistoryEntry extends RepositoryHistoryEntry {
  hash: string;
}

function truncateHistorySubject(subject: string, limit: number): string {
  const normalized = subject.trim();
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

/**
 * Execute a hg (Mercurial) command with consistent options.
 */
async function runHg(args: string[], cwd: string): Promise<{ stdout: string }> {
  return execFileAsync("hg", args, {
    cwd,
    maxBuffer: 100 * 1024 * 1024,
  });
}

/**
 * Detect if the given path is inside a Mercurial repository.
 *
 * `hg identify` exits 0 when inside a Mercurial repository.
 */
export async function detectHg(
  sourceRoot: string,
  run: HgRunner = runHg,
): Promise<boolean> {
  try {
    await run(["identify"], sourceRoot);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract the current Mercurial working-tree state.
 *
 * @returns VCSState with kind="hg" containing tracked, modified, and untracked files.
 *
 * Mercurial status codes:
 * - M: modified
 * - A: added
 * - R: removed
 * - C: clean
 * - !: missing (deleted from working directory)
 * - ?: untracked
 * - I: ignored
 */
export async function getHgState(
  sourceRoot: string,
  run: HgRunner = runHg,
): Promise<VCSState> {
  // `hg files` lists all tracked files in the repository.
  const { stdout: lsOut } = await run(["files"], sourceRoot);
  const trackedFiles = sortLexically(
    lsOut
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  );

  // `hg status` shows the status of all modified and extra files.
  const { stdout: statusOut } = await run(["status"], sourceRoot).catch(() => {
    return { stdout: "" };
  });

  const modifiedFiles: string[] = [];
  const untrackedFiles: string[] = [];

  for (const line of statusOut.split("\n")) {
    if (line.length < 3) continue;
    const status = line[0];
    const filePath = line.slice(2).trim();
    if (!filePath) continue;

    if (status === "?") {
      untrackedFiles.push(filePath);
    } else if (status !== "I" && status !== "C") {
      // Include all tracked file changes except clean (C) and ignored (I)
      modifiedFiles.push(filePath);
    }
  }

  return {
    kind: "hg",
    trackedFiles,
    modifiedFiles: sortLexically(modifiedFiles),
    untrackedFiles: sortLexically(untrackedFiles),
  };
}

export async function getRecentHgHistory(
  sourceRoot: string,
  count: number,
  run: HgRunner = runHg,
): Promise<HgHistoryEntry[]> {
  if (count <= 0) {
    return [];
  }

  const template = "{node}\\t{desc|firstline}\\n";
  const { stdout } = await run(
    ["log", "-l", String(count), "--template", template],
    sourceRoot,
  );

  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [hash, subject] = line.split("\t");
      if (!hash || !subject) {
        return null;
      }
      return {
        hash,
        shortHash: hash.slice(0, 12),
        subject: truncateHistorySubject(subject, DEFAULT_HISTORY_SUBJECT_LIMIT),
      } satisfies HgHistoryEntry;
    })
    .filter((entry): entry is HgHistoryEntry => entry !== null);
}
