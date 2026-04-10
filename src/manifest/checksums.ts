import fs from 'node:fs/promises';
import path from 'node:path';

import { sha256File } from '../shared/hashing.js';

export async function writeChecksumFile(bundleDir: string, checksumFileName: string, relativePaths: string[]): Promise<void> {
  const lines: string[] = [];
  for (const relativePath of [...relativePaths].sort((left, right) => left.localeCompare(right, 'en'))) {
    const hash = await sha256File(path.join(bundleDir, relativePath));
    lines.push(`${hash}  ${relativePath}`);
  }
  await fs.writeFile(path.join(bundleDir, checksumFileName), `${lines.join('\n')}\n`, 'utf8');
}

export function parseChecksumFile(source: string): Array<{ hash: string; relativePath: string }> {
  return source
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => {
      const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
      if (!match) {
        throw new Error(`Invalid checksum line: ${line}`);
      }
      return { hash: match[1]!, relativePath: match[2]! };
    });
}
