/**
 * `cx cleanup <path>` — remove generated bundle metadata files from a bundle
 * directory.
 *
 * By default the command runs in dry-run mode: it lists the files that would
 * be removed without touching the file system. Pass `--force` to perform the
 * actual deletion.
 */

import { unlink, access, constants } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import fg from 'fast-glob';
import kleur from 'kleur';
import { outputJson } from '../utils/output.js';
import { MANIFEST_FILENAME, SHA256SUMS_FILENAME } from '../adapters/repomixAdapter.js';

export interface CleanupCommandOptions {
  /** Actually delete files; when `false` the command performs a dry run. */
  force?: boolean;
  /** Also remove ZIP archives found in the bundle directory. */
  removeZip?: boolean;
  /** Output machine-readable JSON. */
  json?: boolean;
}

/**
 * Execute the `cleanup` command.
 *
 * @param bundlePath  Path to the bundle directory to clean.
 * @param options     Command options.
 */
export async function runCleanup(
  bundlePath: string,
  options: CleanupCommandOptions = {},
): Promise<void> {
  const abs = resolve(bundlePath);

  const candidates: string[] = [
    join(abs, MANIFEST_FILENAME),
    join(abs, SHA256SUMS_FILENAME),
  ];

  if (options.removeZip === true) {
    const zips = await fg(['*.zip'], { cwd: abs, onlyFiles: true });
    candidates.push(...zips.map((z) => join(abs, z)));
  }

  const toRemove = await filterExisting(candidates);

  if (options.json === true) {
    outputJson({
      bundlePath: abs,
      force: options.force === true,
      removeZip: options.removeZip === true,
      dryRun: options.force !== true,
      files: toRemove.map((filePath) => relative(abs, filePath)),
    });
    return;
  }

  if (toRemove.length === 0) {
    console.log(kleur.yellow('Nothing to clean up — no generated files found.'));
    return;
  }

  const dryRun = options.force !== true;
  const heading = dryRun
    ? kleur.yellow('Files that would be removed (dry run):')
    : kleur.cyan('Removing files:');

  console.log(heading);

  for (const filePath of toRemove) {
    console.log(`  ${relative(abs, filePath)}`);
  }

  if (dryRun) {
    console.log(kleur.dim('\nRe-run with --force to remove these files.'));
    return;
  }

  for (const filePath of toRemove) {
    await unlink(filePath);
    console.log(kleur.dim(`  removed: ${relative(abs, filePath)}`));
  }

  console.log(kleur.green(`\n✓ Removed ${toRemove.length} file(s)`));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return only the paths that exist on the file system. */
async function filterExisting(paths: string[]): Promise<string[]> {
  const results = await Promise.all(
    paths.map(async (p) => {
      try {
        await access(p, constants.F_OK);
        return p;
      } catch {
        return null;
      }
    }),
  );
  return results.filter((p): p is string => p !== null);
}
