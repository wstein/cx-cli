/**
 * cx cleanup <bundle-path> [--zip-name <name>] [--all-zips]
 *
 * Removes generated bundle artefacts from the bundle folder:
 *   - manifest.json
 *   - SHA256SUMS
 *   - Optionally: a named zip or all *.zip files
 */

import path from 'node:path';
import kleur from 'kleur';
import { cleanupBundleGeneratedFiles } from '../adapters/repomixAdapter.js';

export interface CleanupOptions {
  zipName?: string;
  allZips?: boolean;
}

export async function cleanupCommand(bundlePath: string, opts: CleanupOptions): Promise<void> {
  const resolved = path.resolve(bundlePath);

  let removed: string[];
  try {
    removed = await cleanupBundleGeneratedFiles(resolved, {
      zipName: opts.zipName,
      removeAllZips: opts.allZips,
    });
  } catch (err) {
    console.error(kleur.red(`Error during cleanup: ${String(err)}`));
    process.exit(1);
  }

  if (removed.length === 0) {
    console.log(kleur.yellow('Nothing to remove — no generated files found.'));
    return;
  }

  console.log(kleur.cyan(`Removed from ${resolved}:`));
  for (const f of removed) {
    console.log(kleur.green(`  ${f}`));
  }
}
