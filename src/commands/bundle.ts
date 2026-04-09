/**
 * cx bundle <PATH-TO-BUNDLE-FOLDER> [options]
 *
 * Scans a bundle folder containing repomix output files and assets,
 * then writes manifest.json and SHA256SUMS into that folder.
 * Optionally produces a .bundle.zip archive.
 */

import path from 'node:path';
import fsPromises from 'node:fs/promises';

import kleur from 'kleur';

import {
  scanBundleFolder,
  writeManifestAndSha,
  createZipFromBundleFolder,
  type BundleManifest,
  type FileEntry,
} from '../adapters/repomixAdapter.js';

export interface BundleOptions {
  /** When true, also create a <folder-name>.bundle.zip alongside the bundle folder. */
  zip?: boolean;
  /** Suppress all non-error output. */
  quiet?: boolean;
}

/**
 * Executes the `bundle` command.
 *
 * @param bundlePath  Path to the bundle folder to process.
 * @param opts        Command options.
 * @returns           The written manifest.
 */
export async function runBundle(
  bundlePath: string,
  opts: BundleOptions = {},
): Promise<BundleManifest> {
  const resolved = path.resolve(bundlePath);

  // Verify the folder exists.
  const stat = await fsPromises.stat(resolved).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    throw new Error(`Bundle path is not a directory: ${resolved}`);
  }

  const log = opts.quiet ? () => undefined : (msg: string) => console.log(msg);

  log(kleur.bold().cyan('Scanning bundle folder…'));
  log(kleur.dim(`  ${resolved}`));

  const manifest = await scanBundleFolder(resolved);

  const totalFiles =
    manifest.repomixFiles.length + manifest.assets.length;

  if (totalFiles === 0) {
    log(
      kleur.yellow(
        'Warning: no files found in the bundle folder (excluding generated artefacts).',
      ),
    );
  } else {
    log(
      kleur.green(
        `  Found ${manifest.repomixFiles.length} repomix file(s) and ${manifest.assets.length} asset(s).`,
      ),
    );
  }

  log(kleur.bold().cyan('Writing manifest.json and SHA256SUMS…'));
  await writeManifestAndSha(resolved, manifest);
  log(kleur.green('  ✔ manifest.json'));
  log(kleur.green('  ✔ SHA256SUMS'));

  if (opts.zip) {
    const folderName = path.basename(resolved);
    const zipName = `${folderName}.bundle.zip`;
    const zipPath = path.join(path.dirname(resolved), zipName);
    log(kleur.bold().cyan(`Creating ${zipName}…`));
    await createZipFromBundleFolder(resolved, zipPath);
    log(kleur.green(`  ✔ ${zipPath}`));
  }

  printSummaryTable(manifest, log);

  return manifest;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function printSummaryTable(
  manifest: BundleManifest,
  log: (msg: string) => void,
): void {
  log('');
  log(kleur.bold('Bundle summary'));
  log(`  Created at : ${manifest.createdAt}`);
  log(`  Format     : ${manifest.format}`);

  const allEntries: FileEntry[] = [
    ...manifest.repomixFiles,
    ...manifest.assets,
  ];

  if (allEntries.length === 0) {
    log(kleur.dim('  (empty bundle)'));
    return;
  }

  log('');
  log(kleur.bold('  Files:'));
  for (const entry of allEntries) {
    const tag = manifest.repomixFiles.includes(entry)
      ? kleur.cyan('[repomix]')
      : kleur.dim('[asset]  ');
    const size = formatBytes(entry.size);
    const lines =
      entry.lines !== undefined
        ? kleur.dim(` ${entry.lines} lines`)
        : entry.isBinary
        ? kleur.dim(' (binary)')
        : '';
    log(`    ${tag} ${entry.path}  ${kleur.dim(size)}${lines}`);
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
