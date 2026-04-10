/**
 * `cx bundle <path>` — scan a bundle directory, compute SHA-256 digests,
 * write `manifest.json` and `SHA256SUMS`, and optionally create a ZIP archive.
 */

import { basename, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import kleur from 'kleur';
import type { CxConfig } from './init.js';
import { countFileTokens, processBundle } from '../adapters/repomixAdapter.js';
import { configDirectory, resolveConfigFilePath, resolveConfigPath } from '../utils/paths.js';

export interface BundleCommandOptions {
  /** Create a ZIP archive of the completed bundle. */
  zip?: boolean;
  /** Custom output path for the ZIP archive. */
  zipOutput?: string;
  /** Additional fast-glob ignore patterns. */
  exclude?: string[];
  /** Print detailed bundle diagnostics. */
  verbose?: boolean;
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
  bundlePath: string | undefined,
  options: BundleCommandOptions = {},
): Promise<void> {
  const cxConfigFile = resolveConfigFilePath(process.cwd(), options.cxConfig ?? 'cx.json');
  const bundleRoot = bundlePath !== undefined ? resolveConfigPath(process.cwd(), bundlePath) : await resolveDefaultBundlePath(cxConfigFile);
  const shouldGenerateSections =
    options.sections === true ||
    (bundlePath === undefined && (await cxConfigHasSections(cxConfigFile)));
  console.log(kleur.cyan(`Bundling: ${bundleRoot}`));

  if (options.verbose === true) {
    console.log(kleur.dim('Verbose mode enabled: emitting bundle diagnostics.'));
  }

  if (shouldGenerateSections) {
    const { runRepomixSections } = await import('./repomixSections.js');
    await runRepomixSections({
      ...(options.cxConfig !== undefined && { cxConfig: options.cxConfig }),
      ...(options.repomixConfig !== undefined && { config: options.repomixConfig }),
      outputDir: bundleRoot,
      ...(options.sectionChecksumFile !== undefined && { checksumFile: options.sectionChecksumFile }),
      verbose: options.sectionVerbose === true || options.verbose === true,
    });
  }

  const manifest = await processBundle(bundleRoot, {
    ...(options.zip !== undefined && { createZip: options.zip }),
    ...(options.zipOutput !== undefined && { zipOutputPath: options.zipOutput }),
    ...(options.exclude !== undefined && { exclude: options.exclude }),
  });

  const repomixFiles = manifest.files.filter((f) => f.type === 'repomix');
  const repomixCount = repomixFiles.length;
  const binaryCount = manifest.files.filter((f) => f.type === 'binary').length;
  const totalBytes = manifest.files.reduce((acc, f) => acc + f.size, 0);

  console.log(kleur.green(`✓ Bundle complete — ${manifest.files.length} file(s), ${formatBytes(totalBytes)}`));

  if (repomixCount > 0) {
    console.log(kleur.dim(`  ${repomixCount} repomix file(s)`));
    const repomixSummary = await summarizeRepomixStats(bundleRoot, repomixFiles);
    console.log(kleur.cyan('📊 Bundle Summary:'));
    console.log(kleur.cyan('────────────────'));
    console.log(`Total Files: ${manifest.files.length} file(s)`);
    console.log('');
    for (const artifact of repomixSummary.artifacts) {
      console.log(
        `  ${kleur.bold(artifact.path)}  ${kleur.cyan(`${formatNumber(artifact.tokens)} tokens`)}  ${kleur.yellow(`${formatNumber(artifact.bytes)} bytes`)}  ${kleur.green(`${artifact.portion}%`)}`,
      );
    }
    console.log('');
    console.log(`  Total Tokens: ${formatNumber(repomixSummary.totalTokens)} tokens`);
    console.log(`  Total Chars: ${formatNumber(repomixSummary.totalChars)} chars`);
  }

  if (binaryCount > 0) console.log(kleur.dim(`  ${binaryCount} binary asset(s)`));
  console.log(kleur.dim('  manifest → manifest.json'));
  console.log(kleur.dim('  checksums → SHA256SUMS'));
  console.log(kleur.dim(`  written to ${bundleRoot}`));

  if (options.verbose === true) {
    console.log(kleur.dim('Detailed bundle contents:'));
    for (const file of manifest.files) {
      console.log(kleur.dim(`  ${file.type.padEnd(9)} ${file.path} (${file.size} bytes)`));
      console.log(kleur.dim(`    sha256 ${file.sha256}`));
    }
  }

  if (options.zip === true) {
    const zipName = options.zipOutput ?? `${basename(bundleRoot)}.zip`;
    console.log(kleur.dim(`  archive → ${zipName}`));
  }
}

async function resolveDefaultBundlePath(cxConfigFile: string): Promise<string> {
  try {
    const cxConfigSource = await readFile(cxConfigFile, 'utf8');
    const cxConfig = JSON.parse(cxConfigSource) as CxConfig;
    const outputDir = cxConfig.bundle?.outputDir;
    if (typeof outputDir === 'string' && outputDir.length > 0) {
      return resolveConfigPath(configDirectory(cxConfigFile), outputDir);
    }
  } catch {
    // Fall back to the current working directory if no valid cx.json is available.
  }

  return resolve('.');
}

async function cxConfigHasSections(cxConfigFile: string): Promise<boolean> {
  try {
    const cxConfigSource = await readFile(cxConfigFile, 'utf8');
    const cxConfig = JSON.parse(cxConfigSource) as CxConfig;
    return cxConfig.sections !== undefined &&
      cxConfig.sections !== null &&
      typeof cxConfig.sections === 'object' &&
      Object.keys(cxConfig.sections).length > 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type RepomixArtifactSummary = {
  path: string;
  tokens: number;
  bytes: number;
  chars: number;
  portion: number;
};

type RepomixStatsSummary = {
  totalTokens: number;
  totalChars: number;
  artifacts: RepomixArtifactSummary[];
};

async function summarizeRepomixStats(
  bundleRoot: string,
  repomixFiles: Array<{ path: string; size: number }> | undefined,
): Promise<RepomixStatsSummary> {
  const artifacts: Array<Omit<RepomixArtifactSummary, 'portion'>> = [];
  if (repomixFiles === undefined) {
    return { totalTokens: 0, totalChars: 0, artifacts: [] };
  }

  for (const file of repomixFiles) {
    const filePath = resolve(bundleRoot, file.path);
    const fileContent = await readFile(filePath, 'utf8');
    const tokenCount = countFileTokens(fileContent);
    artifacts.push({
      path: file.path,
      tokens: tokenCount,
      bytes: file.size,
      chars: fileContent.length,
    });
  }

  const totalTokens = artifacts.reduce((sum, artifact) => sum + artifact.tokens, 0);
  const totalChars = artifacts.reduce((sum, artifact) => sum + artifact.chars, 0);

  return {
    totalTokens,
    totalChars,
    artifacts: artifacts.map((artifact) => ({
      ...artifact,
      portion: totalTokens === 0 ? 0 : Number(((artifact.tokens / totalTokens) * 100).toFixed(0)),
    })),
  };
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
