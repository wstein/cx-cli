/**
 * cx cleanup <BUNDLE-FOLDER> [options]
 *
 * Removes cx-generated artefacts from a bundle folder:
 *  - manifest.json
 *  - SHA256SUMS
 *  - Optionally a named .bundle.zip file
 */

import path from 'node:path';
import fsPromises from 'node:fs/promises';

import kleur from 'kleur';

import { cleanupBundleGeneratedFiles } from '../adapters/repomixAdapter.js';

export interface CleanupOptions {
  /**
   * Name of the ZIP file to also remove.
   * Defaults to `<folder-name>.bundle.zip` when `--zip` is passed.
   */
  zipName?: string;
  /** Remove the ZIP archive named `<folder-name>.bundle.zip`. */
  zip?: boolean;
  /** Suppress non-error output. */
  quiet?: boolean;
}

export interface CleanupResult {
  /** Names of files that were removed. */
  removed: string[];
  /** Names of files that did not exist and were therefore skipped. */
  notFound: string[];
}

/**
 * Executes the `cleanup` command.
 *
 * @param bundlePath  Path to the bundle folder to clean.
 * @param opts        Command options.
 * @returns           Summary of removed and missing files.
 */
export async function runCleanup(
  bundlePath: string,
  opts: CleanupOptions = {},
): Promise<CleanupResult> {
  const resolved = path.resolve(bundlePath);

  const stat = await fsPromises.stat(resolved).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    throw new Error(`Bundle path is not a directory: ${resolved}`);
  }

  const log = opts.quiet ? () => undefined : (msg: string) => console.log(msg);

  log(kleur.bold().cyan('Cleaning up generated artefacts…'));
  log(kleur.dim(`  ${resolved}`));

  // Remove generated files from inside the bundle folder.
  const removedInside = await cleanupBundleGeneratedFiles(resolved);

  // The ZIP archive lives next to the bundle folder (not inside it).
  let zipRemoved: string | undefined;
  if (opts.zip || opts.zipName) {
    const zipFileName =
      opts.zipName ?? `${path.basename(resolved)}.bundle.zip`;
    const zipPath = path.join(path.dirname(resolved), zipFileName);
    try {
      await fsPromises.unlink(zipPath);
      zipRemoved = zipPath;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  // Build removed / not-found lists for output.
  const removed: string[] = [...removedInside];
  const candidates = ['manifest.json', 'SHA256SUMS'];
  const removedSet = new Set(removedInside);
  const notFound = candidates.filter(name => !removedSet.has(name));

  for (const name of removed) {
    log(kleur.green(`  ✔ Removed ${name}`));
  }
  if (zipRemoved) {
    log(kleur.green(`  ✔ Removed ${path.basename(zipRemoved)}`));
    removed.push(path.basename(zipRemoved));
  } else if (opts.zip || opts.zipName) {
    const zipFileName =
      opts.zipName ?? `${path.basename(resolved)}.bundle.zip`;
    notFound.push(zipFileName);
  }
  for (const name of notFound) {
    log(kleur.dim(`  − ${name} not found (skipped)`));
  }

  if (removed.length === 0) {
    log(kleur.dim('  Nothing to clean up.'));
  } else {
    log('');
    log(
      kleur.green(
        `Cleaned up ${removed.length} file(s) from ${path.basename(resolved)}.`,
      ),
    );
  }

  return { removed, notFound };
}
