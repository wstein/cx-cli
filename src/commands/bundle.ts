/**
 * cx bundle <bundle-path> [--zip [zip-name]]
 *
 * Scans the bundle folder, writes manifest.json and SHA256SUMS,
 * and optionally creates a zip archive.
 */

import path from 'node:path';
import kleur from 'kleur';
import {
  scanBundleFolder,
  writeManifestAndSha,
  createZipFromBundleFolder,
} from '../adapters/repomixAdapter.js';

export interface BundleOptions {
  zip?: boolean | string;
  include?: string;
}

export async function bundleCommand(bundlePath: string, opts: BundleOptions): Promise<void> {
  const resolved = path.resolve(bundlePath);

  console.log(kleur.cyan(`Scanning bundle folder: ${resolved}`));

  let manifest;
  try {
    manifest = await scanBundleFolder(resolved);
  } catch (err) {
    console.error(kleur.red(`Error scanning bundle folder: ${String(err)}`));
    process.exit(1);
  }

  const totalFiles = manifest.repomixFiles.length + manifest.assets.length;
  console.log(
    kleur.green(`  Found ${manifest.repomixFiles.length} repomix file(s) and ${manifest.assets.length} asset(s) (${totalFiles} total)`),
  );

  let manifestPath: string;
  let sha256sumsPath: string;
  try {
    ({ manifestPath, sha256sumsPath } = await writeManifestAndSha(manifest, resolved));
  } catch (err) {
    console.error(kleur.red(`Error writing manifest: ${String(err)}`));
    process.exit(1);
  }

  console.log(kleur.green(`  Wrote ${path.relative(process.cwd(), manifestPath)}`));
  console.log(kleur.green(`  Wrote ${path.relative(process.cwd(), sha256sumsPath)}`));

  if (opts.zip !== undefined && opts.zip !== false) {
    const zipName =
      typeof opts.zip === 'string' && opts.zip.length > 0
        ? opts.zip
        : `${path.basename(resolved)}.zip`;
    const zipPath = path.isAbsolute(zipName) ? zipName : path.join(resolved, zipName);

    console.log(kleur.cyan(`  Creating zip archive: ${path.relative(process.cwd(), zipPath)}`));
    try {
      await createZipFromBundleFolder(resolved, zipPath, { includeGenerated: true });
    } catch (err) {
      console.error(kleur.red(`Error creating zip: ${String(err)}`));
      process.exit(1);
    }
    console.log(kleur.green(`  Zip created: ${path.relative(process.cwd(), zipPath)}`));
  }

  console.log(kleur.bold().green('Done.'));
}
