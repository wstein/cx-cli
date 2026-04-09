/**
 * cx list <bundle-path>/<repomix-file>
 *
 * Parses a repomix output file and lists the file paths it contains.
 */

import path from 'node:path';
import kleur from 'kleur';
import { parseRepomixFile } from '../adapters/repomixAdapter.js';

export async function listCommand(target: string): Promise<void> {
  const resolved = path.resolve(target);

  let files: string[];
  try {
    files = await parseRepomixFile(resolved);
  } catch (err) {
    console.error(kleur.red(`Error reading repomix file: ${String(err)}`));
    process.exit(1);
  }

  if (files.length === 0) {
    console.log(kleur.yellow('No files found in the repomix output.'));
    return;
  }

  console.log(kleur.cyan(`Files in ${path.basename(resolved)} (${files.length}):`));
  for (const f of files) {
    console.log(`  ${f}`);
  }
}
