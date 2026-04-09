/**
 * `cx bundle <path>` — scan a bundle directory, compute SHA-256 digests,
 * write `manifest.json` and `SHA256SUMS`, and optionally create a ZIP archive.
 */

import { basename, resolve } from 'node:path';
import kleur from 'kleur';
import { processBundle } from '../adapters/repomixAdapter.js';

export interface BundleCommandOptions {
  /** Create a ZIP archive of the completed bundle. */
  zip?: boolean;
  /** Custom output path for the ZIP archive. */
  zipOutput?: string;
  /** Additional fast-glob ignore patterns. */
  exclude?: string[];
  /** Generate repomix section outputs before bundling. */
  sections?: boolean;
  /** Path to the CX configuration file. */
  cxConfig?: string;
  /** Path to the repomix configuration file. */
  repomixConfig?: string;
  /** Checksum file path for generated repomix sections. */
  sectionChecksumFile?: string;
  /** Show verbose progress during section generation. */
  sectionVerbose?: boolean;
}

/**
 * Execute the `bundle` command.
 *
 * @param bundlePath  Path to the directory to process.
 * @param options     Command options.
 */
export async function runBundle(
  bundlePath: string,
  options: BundleCommandOptions = {},
): Promise<void> {
  const abs = resolve(bundlePath);

  console.log(kleur.cyan(`Bundling: ${abs}`));

  if (options.sections === true) {
    const { runRepomixSections } = await import('./repomixSections.js');
    await runRepomixSections({
      ...(options.cxConfig !== undefined && { cxConfig: options.cxConfig }),
      ...(options.repomixConfig !== undefined && { config: options.repomixConfig }),
      outputDir: abs,
      ...(options.sectionChecksumFile !== undefined && { checksumFile: options.sectionChecksumFile }),
      ...(options.sectionVerbose !== undefined && { verbose: options.sectionVerbose }),
    });
  }

  const manifest = await processBundle(abs, {
    ...(options.zip !== undefined && { createZip: options.zip }),
    ...(options.zipOutput !== undefined && { zipOutputPath: options.zipOutput }),
    ...(options.exclude !== undefined && { exclude: options.exclude }),
  });

  const repomixCount = manifest.files.filter((f) => f.type === 'repomix').length;
  const binaryCount = manifest.files.filter((f) => f.type === 'binary').length;
  const totalBytes = manifest.files.reduce((acc, f) => acc + f.size, 0);

  console.log(kleur.green(`✓ Bundle complete — ${manifest.files.length} file(s), ${formatBytes(totalBytes)}`));

  if (repomixCount > 0) console.log(kleur.dim(`  ${repomixCount} repomix file(s)`));
  if (binaryCount > 0) console.log(kleur.dim(`  ${binaryCount} binary asset(s)`));
  console.log(kleur.dim('  manifest → manifest.json'));
  console.log(kleur.dim('  checksums → SHA256SUMS'));

  if (options.zip === true) {
    const zipName = options.zipOutput ?? `${basename(abs)}.zip`;
    console.log(kleur.dim(`  archive → ${zipName}`));
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
