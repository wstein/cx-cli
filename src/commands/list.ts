/**
 * cx list <BUNDLE-FOLDER>[/<REPOMIX-FILE>] [options]
 *
 * Lists the source files recorded inside one or more repomix output files.
 *
 * If the argument points to a repomix output file, only that file is listed.
 * If the argument points to a bundle folder, all repomix files discovered
 * in that folder are listed in sequence.
 */

import path from 'node:path';
import fsPromises from 'node:fs/promises';

import kleur from 'kleur';

import {
  parseRepomixFile,
  scanBundleFolder,
  type RepomixEntry,
} from '../adapters/repomixAdapter.js';

export interface ListOptions {
  /** Print one path per line with no decoration (useful for piping). */
  plain?: boolean;
  /** Suppress totals and headers; equivalent to --plain for scripting. */
  quiet?: boolean;
}

/**
 * Executes the `list` command.
 *
 * @param target  Path to a repomix output file or a bundle folder.
 * @param opts    Command options.
 * @returns       All entries found across all processed repomix files.
 */
export async function runList(
  target: string,
  opts: ListOptions = {},
): Promise<RepomixEntry[]> {
  const resolved = path.resolve(target);

  const stat = await fsPromises.stat(resolved).catch(() => null);
  if (!stat) {
    throw new Error(`Path does not exist: ${resolved}`);
  }

  const plain = opts.plain || opts.quiet;
  const log = (msg: string) => console.log(msg);

  let repomixFilePaths: string[];

  if (stat.isDirectory()) {
    // Scan the folder to find repomix output files.
    const manifest = await scanBundleFolder(resolved);
    if (manifest.repomixFiles.length === 0) {
      if (!plain) {
        console.error(
          kleur.yellow('No repomix output files found in:') + ` ${resolved}`,
        );
      }
      return [];
    }
    repomixFilePaths = manifest.repomixFiles.map(f =>
      path.join(resolved, f.path),
    );
  } else {
    repomixFilePaths = [resolved];
  }

  const allEntries: RepomixEntry[] = [];

  for (const filePath of repomixFilePaths) {
    const entries = await parseRepomixFile(filePath);

    if (!plain) {
      log(
        kleur.bold().cyan(`\n${path.relative(process.cwd(), filePath)}`) +
          kleur.dim(` — ${entries.length} file(s)`),
      );
    }

    for (const entry of entries) {
      if (plain) {
        log(entry.path);
      } else {
        const charInfo =
          entry.charCount !== undefined
            ? kleur.dim(`  ${formatChars(entry.charCount)}`)
            : '';
        log(`  ${entry.path}${charInfo}`);
      }
    }

    allEntries.push(...entries);
  }

  if (!plain && allEntries.length > 0) {
    console.log(
      kleur.dim(`\nTotal: ${allEntries.length} source file(s) across ${repomixFilePaths.length} repomix output(s).`),
    );
  }

  return allEntries;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function formatChars(chars: number): string {
  if (chars < 1000) return `${chars} chars`;
  if (chars < 1_000_000) return `${(chars / 1000).toFixed(1)} k chars`;
  return `${(chars / 1_000_000).toFixed(1)} M chars`;
}
