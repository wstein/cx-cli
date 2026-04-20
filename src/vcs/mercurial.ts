import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { RepositoryHistoryEntry } from "../render/handover.js";
import { sortLexically } from "../shared/fs.js";
import type { VCSState } from "./provider.js";

const execFileAsync = promisify(execFile);

type HgRunner = (args: string[], cwd: string) => Promise<{ stdout: string }>;
const HISTORY_RECORD_SEPARATOR = "\u001e";
const HISTORY_FIELD_SEPARATOR = "\u001f";

export interface HgHistoryEntry extends RepositoryHistoryEntry {
  hash: string;
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

  const template = `{node}${HISTORY_FIELD_SEPARATOR}{desc}${HISTORY_RECORD_SEPARATOR}`;
  const { stdout } = await run(
    ["log", "-l", String(count), "--template", template],
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
      } satisfies HgHistoryEntry;
    })
    .filter((entry): entry is HgHistoryEntry => entry !== null);
}
