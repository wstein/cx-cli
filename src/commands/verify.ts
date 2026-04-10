/**
 * `cx verify <path>` — verify bundle integrity by checking manifest and SHA256SUMS.
 */

import { readFile } from 'node:fs/promises';
import kleur from 'kleur';
import type { CxConfig } from './init.js';
import { verifyBundle } from '../adapters/repomixAdapter.js';
import { outputJson } from '../utils/output.js';
import { configDirectory, resolveConfigFilePath, resolveConfigPath } from '../utils/paths.js';

export interface VerifyCommandOptions {
  /** Path to the CX configuration file. */
  cxConfig?: string;
  /** Print verbose verification details. */
  verbose?: boolean;
  /** Output machine-readable JSON. */
  json?: boolean;
}

export async function runVerify(
  bundlePath: string | undefined,
  options: VerifyCommandOptions = {},
): Promise<void> {
  const cxConfigFile = resolveConfigFilePath(process.cwd(), options.cxConfig ?? 'cx.json');
  const bundleRoot = bundlePath !== undefined
    ? resolveConfigPath(process.cwd(), bundlePath)
    : await resolveDefaultBundlePath(cxConfigFile);

  console.log(kleur.cyan(`Verifying bundle: ${bundleRoot}`));

  const result = await verifyBundle(bundleRoot);

  if (options.json === true) {
    outputJson({
      bundlePath: bundleRoot,
      valid: result.valid,
      checkedFiles: result.checkedFiles,
      totalManifestFiles: result.totalManifestFiles,
      totalChecksumEntries: result.totalChecksumEntries,
      errors: result.errors,
      warnings: result.warnings,
    });

    if (!result.valid) {
      throw new Error('Bundle verification failed');
    }
    return;
  }

  if (result.warnings.length > 0) {
    console.log(kleur.yellow('Warnings:'));
    for (const warning of result.warnings) {
      console.log(`  ${warning}`);
    }
  }

  if (!result.valid) {
    console.log(kleur.red('✖ Bundle verification failed.'));
    for (const error of result.errors) {
      console.log(`  ${kleur.red(error)}`);
    }
    throw new Error('Bundle verification failed');
  }

  console.log(kleur.green('✓ Bundle verified successfully'));
  console.log(`  Data files checked: ${result.checkedFiles}`);
  console.log(`  Manifest files:   ${result.totalManifestFiles}`);
  console.log(`  Checksum entries: ${result.totalChecksumEntries}`);

  if (options.verbose === true) {
    console.log(kleur.dim('All SHA256 hashes match the recorded bundle metadata.'));
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

  return resolveConfigPath(process.cwd(), '.');
}
