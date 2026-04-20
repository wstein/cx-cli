import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { RepositoryHistoryEntry } from "../render/handover.js";
import { sortLexically } from "../shared/fs.js";
import type { VCSState } from "./provider.js";

const execFileAsync = promisify(execFile);

type FossilRunner = (
  args: string[],
  cwd: string,
) => Promise<{ stdout: string }>;
const DEFAULT_HISTORY_SUBJECT_LIMIT = 120;

export interface FossilHistoryEntry extends RepositoryHistoryEntry {
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
 * Execute a fossil command with consistent options.
 */
async function runFossil(
  args: string[],
  cwd: string,
): Promise<{ stdout: string }> {
  return execFileAsync("fossil", args, {
    cwd,
    maxBuffer: 100 * 1024 * 1024,
  });
}

/**
 * Detect if the given path is inside a Fossil repository.
 *
 * `fossil ls` exits 0 only from inside a checked-out repository.
 */
export async function detectFossil(
  sourceRoot: string,
  run: FossilRunner = runFossil,
): Promise<boolean> {
  try {
    await run(["ls"], sourceRoot);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract the current Fossil working-tree state.
 *
 * @returns VCSState with kind="fossil" containing tracked, modified, and untracked files.
 */
export async function getFossilState(
  sourceRoot: string,
  run: FossilRunner = runFossil,
): Promise<VCSState> {
  const { stdout: lsOut } = await run(["ls"], sourceRoot);
  const trackedFiles = sortLexically(
    lsOut
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  );

  // `fossil status` prints one "STATUS   path" line per changed or extra file.
  // Lines with status EXTRA are untracked; all other non-UNCHANGED statuses
  // represent tracked files with local modifications.
  const { stdout: statusOut } = await run(["status"], sourceRoot).catch(() => ({
    stdout: "",
  }));

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

export async function getRecentFossilHistory(
  sourceRoot: string,
  count: number,
  run: FossilRunner = runFossil,
): Promise<FossilHistoryEntry[]> {
  if (count <= 0) {
    return [];
  }

  const { stdout } = await run(
    ["timeline", "-t", "ci", "-n", String(count), "-F", "%H\t%s"],
    sourceRoot,
  );

  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [hash, ...subjectParts] = line.split("\t");
      const subject = subjectParts.join("\t");
      if (!hash || !subject) {
        return null;
      }
      return {
        hash,
        shortHash: hash.slice(0, 12),
        subject: truncateHistorySubject(subject, DEFAULT_HISTORY_SUBJECT_LIMIT),
      } satisfies FossilHistoryEntry;
    })
    .filter((entry): entry is FossilHistoryEntry => entry !== null);
}
