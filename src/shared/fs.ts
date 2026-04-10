import fs from 'node:fs/promises';
import path from 'node:path';

import { toPosixPath } from './paths.js';

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function listFilesRecursive(rootDir: string): Promise<string[]> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const results = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(rootDir, entry.name);
      if (entry.isDirectory()) {
        return listFilesRecursive(absolutePath);
      }

      if (entry.isFile()) {
        return [absolutePath];
      }

      return [];
    }),
  );

  return results.flat();
}

export function sortLexically(values: readonly string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right, 'en'));
}

export function relativePosix(rootDir: string, filePath: string): string {
  return toPosixPath(path.relative(rootDir, filePath));
}
