import fs from 'node:fs/promises';
import path from 'node:path';

import { loadManifestFromBundle } from '../../bundle/validate.js';

export interface ListArgs {
  bundleDir: string;
  json: boolean;
}

export async function runListCommand(args: ListArgs): Promise<number> {
  const { manifest, manifestName } = await loadManifestFromBundle(path.resolve(args.bundleDir));

  if (args.json) {
    process.stdout.write(`${JSON.stringify({ manifestName, files: manifest.files }, null, 2)}\n`);
    return 0;
  }

  const lines = [
    `manifest: ${manifestName}`,
    ...manifest.files.map((file) => `${file.kind}\t${file.path}\t${file.section}`),
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
  return 0;
}
