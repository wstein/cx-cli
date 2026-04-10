import fs from 'node:fs/promises';
import path from 'node:path';

import { parseChecksumFile } from '../manifest/checksums.js';
import { parseManifestToon } from '../manifest/toon.js';
import { pathExists } from '../shared/fs.js';
import { CxError } from '../shared/errors.js';

export async function loadManifestFromBundle(bundleDir: string) {
  const entries = await fs.readdir(bundleDir);
  const manifestName = entries.find((entry) => entry.endsWith('-manifest.toon'));
  if (!manifestName) {
    throw new CxError('Bundle is missing a manifest file.', 2);
  }

  const manifestSource = await fs.readFile(path.join(bundleDir, manifestName), 'utf8');
  return { manifest: parseManifestToon(manifestSource), manifestName };
}

export async function validateBundle(bundleDir: string): Promise<{ manifestName: string }> {
  const { manifest, manifestName } = await loadManifestFromBundle(bundleDir);
  if (manifest.schemaVersion !== 1 || manifest.bundleVersion !== 1) {
    throw new CxError('Unsupported manifest schema version.', 2);
  }

  for (const section of manifest.sections) {
    if (!await pathExists(path.join(bundleDir, section.outputFile))) {
      throw new CxError(`Bundle is missing section output ${section.outputFile}.`, 2);
    }
  }

  for (const asset of manifest.assets) {
    if (!await pathExists(path.join(bundleDir, asset.storedPath))) {
      throw new CxError(`Bundle is missing asset ${asset.storedPath}.`, 2);
    }
  }

  const checksumPath = path.join(bundleDir, manifest.checksumFile);
  if (!await pathExists(checksumPath)) {
    throw new CxError(`Bundle is missing checksum file ${manifest.checksumFile}.`, 2);
  }

  parseChecksumFile(await fs.readFile(checksumPath, 'utf8'));
  return { manifestName };
}
