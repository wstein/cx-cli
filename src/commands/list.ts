/**
 * `cx list <path>` — list the contents of a bundle directory (via its
 * `manifest.json`) or enumerate the source-file entries packed inside a
 * single repomix output file.
 */

import { extname, resolve } from 'node:path';
import kleur from 'kleur';
import { outputJson } from '../utils/output.js';
import { parseRepomixFile, readManifest } from '../adapters/repomixAdapter.js';

export interface ListCommandOptions {
  /** Print SHA-256 digests, sizes, and line counts alongside each entry. */
  verbose?: boolean;
  /** Output machine-readable JSON. */
  json?: boolean;
}

/** Extensions that indicate a potential repomix output file. */
const REPOMIX_FILE_EXTENSIONS = new Set(['.xml', '.json', '.txt', '.md']);

/**
 * Execute the `list` command.
 *
 * - If `targetPath` is a directory, the command reads `manifest.json` and
 *   prints every file in the bundle.
 * - If `targetPath` is a file with a repomix-compatible extension, the
 *   command parses it and lists the packed source-file entries.
 *
 * @param targetPath  Path to a bundle directory or a repomix output file.
 * @param options     Command options.
 */
export async function runList(
  targetPath: string,
  options: ListCommandOptions = {},
): Promise<void> {
  const abs = resolve(targetPath);
  const ext = extname(abs).toLowerCase();

  // Try repomix file first when the extension matches.
  if (REPOMIX_FILE_EXTENSIONS.has(ext)) {
    const listed = await tryListRepomixFile(abs, options);
    if (listed) return;
  }

  // Fall back to bundle directory listing.
  await listBundleDirectory(abs, options);
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Attempt to parse `filePath` as a repomix output and print its entries.
 * Returns `true` on success; `false` if the file is not a repomix output.
 */
async function tryListRepomixFile(
  filePath: string,
  options: ListCommandOptions,
): Promise<boolean> {
  try {
    const parsed = await parseRepomixFile(filePath);

    if (options.json === true) {
      const entries = parsed.entries.map((entry) => ({
        path: entry.path,
        lines: entry.content.split('\n').length,
        chars: entry.content.length,
      }));
      outputJson({
        type: 'repomix',
        filePath,
        format: parsed.style,
        entries,
      });
      return true;
    }

    console.log(kleur.cyan(`Repomix file: ${filePath}`));
    console.log(
      kleur.dim(`Format: ${parsed.style}  ·  ${parsed.entries.length} source file(s)`),
    );

    if (parsed.entries.length === 0) {
      console.log(kleur.yellow('  (no parsable entries — file may use plain or Markdown style)'));
      return true;
    }

    for (const entry of parsed.entries) {
      if (options.verbose === true) {
        const lines = entry.content.split('\n').length;
        const chars = entry.content.length;
        console.log(
          `  ${entry.path}  ${kleur.dim(`${lines} line(s), ${chars} char(s)`)}`,
        );
      } else {
        console.log(`  ${entry.path}`);
      }
    }

    return true;
  } catch {
    return false;
  }
}

/** Read the bundle's `manifest.json` and print the contained files. */
async function listBundleDirectory(
  bundlePath: string,
  options: ListCommandOptions,
): Promise<void> {
  let manifest;
  try {
    manifest = await readManifest(bundlePath);
  } catch {
    throw new Error(
      `Cannot list "${bundlePath}": no manifest.json found and the path is not a repomix file.\n` +
        'Run `cx bundle <path>` first to generate bundle metadata.',
    );
  }

  if (options.json === true) {
    outputJson({
      type: 'bundle',
      bundlePath,
      createdAt: manifest.createdAt,
      files: manifest.files.map((file) => ({
        path: file.path,
        type: file.type,
        size: file.size,
        sha256: options.verbose === true ? file.sha256 : undefined,
      })),
    });
    return;
  }

  console.log(kleur.cyan(`Bundle: ${bundlePath}`));
  console.log(
    kleur.dim(`Created: ${manifest.createdAt}  ·  ${manifest.files.length} file(s)`),
  );

  const typeColour: Record<string, (s: string) => string> = {
    repomix: kleur.cyan,
    binary: kleur.magenta,
    manifest: kleur.yellow,
    checksum: kleur.green,
  };

  for (const file of manifest.files) {
    const colour = typeColour[file.type] ?? kleur.white;
    const tag = colour(`[${file.type}]`);
    const size = kleur.dim(formatBytes(file.size));

    if (options.verbose === true) {
      console.log(`  ${file.path}  ${tag}  ${size}  ${kleur.dim(file.sha256.slice(0, 16) + '…')}`);
    } else {
      console.log(`  ${file.path}  ${tag}  ${size}`);
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
