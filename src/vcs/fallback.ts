import {
  listFilesRecursive,
  relativePosix,
  sortLexically,
} from "../shared/fs.js";
import type { VCSState } from "./provider.js";

/**
 * Extract filesystem state as a fallback when no VCS is detected.
 *
 * @returns VCSState with kind="none" containing all files on disk.
 *          modifiedFiles and untrackedFiles are always empty for filesystem fallback.
 */
export async function getFilesystemState(
  sourceRoot: string,
): Promise<VCSState> {
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
