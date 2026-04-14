import type { CxConfig } from "../config/types.js";
import {
  listFilesRecursive,
  relativePosix,
  sortLexically,
} from "../shared/fs.js";
import { isSubpath } from "../shared/paths.js";
import type { VCSState } from "../vcs/provider.js";
import { compileMatchers, matchesAny } from "./overlaps.js";

/**
 * Build the master file list for planning.
 *
 * Pipeline:
 * 1. Start with the VCS-tracked file list (or all disk files when VCS is absent).
 * 2. Apply `[files] include` patterns: extend the set with additional files
 *    from disk that match the patterns (for non-VCS-tracked files that must
 *    still be bundled).
 * 3. Apply `[files] exclude` patterns as a security override: strip matching
 *    files unconditionally before any section sorting begins.
 * 4. Always strip the output directory to prevent self-referential bundles.
 */
export async function buildMasterList(
  config: CxConfig,
  vcsState: VCSState,
): Promise<string[]> {
  const masterSet = new Set<string>(vcsState.trackedFiles);

  // Extend with explicitly included non-VCS files (e.g. generated outputs).
  if (config.files.include.length > 0) {
    const includeMatchers = compileMatchers(config.files.include);
    const allDiskFiles = await listFilesRecursive(config.sourceRoot);
    for (const absolute of allDiskFiles) {
      const relative = relativePosix(config.sourceRoot, absolute);
      if (matchesAny(includeMatchers, relative)) {
        masterSet.add(relative);
      }
    }
  }

  // Security override: strip excluded files from the master set before any
  // section glob evaluation, including the output directory itself.
  const outputExcluded = isSubpath(config.sourceRoot, config.outputDir)
    ? relativePosix(config.sourceRoot, config.outputDir)
    : undefined;
  const globalExcludeMatchers = compileMatchers([
    ...config.files.exclude,
    ...(outputExcluded ? [`${outputExcluded}/**`] : []),
  ]);

  return sortLexically(
    [...masterSet].filter(
      (relativePath) => !matchesAny(globalExcludeMatchers, relativePath),
    ),
  );
}
