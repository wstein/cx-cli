/**
 * Register all repomix-bundle commands with a `cac` CLI application instance.
 *
 * This module is framework-agnostic in the sense that it only depends on the
 * public `CAC` type from the `cac` package.  Swap `cac` for another framework
 * by replacing the registration glue below while keeping the command handlers
 * in `../commands/*` unchanged.
 *
 * @example
 * ```ts
 * import { cac } from 'cac';
 * import { registerRepomixCommands } from './cli/repomix-commands.js';
 *
 * const cli = cac('cx');
 * registerRepomixCommands(cli);
 * cli.help();
 * cli.parse();
 * ```
 */

import process from 'node:process';
import type { CAC } from 'cac';
import kleur from 'kleur';
import { runBundle } from '../commands/bundle.js';
import { runCleanup } from '../commands/cleanup.js';
import { runInit } from '../commands/init.js';
import { runList } from '../commands/list.js';
import { runRepomix } from '../commands/repomix.js';

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------

/**
 * Wrap a command action so that any thrown error is printed and the process
 * exits with code 1.  Prevents unhandled-rejection noise.
 */
function action<T extends unknown[]>(fn: (...args: T) => Promise<void>): (...args: T) => void {
  return (...args: T) => {
    fn(...args).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(kleur.red(`Error: ${message}`));
      process.exitCode = 1;
    });
  };
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

/**
 * Register the repomix-bundle commands with the provided `cac` instance.
 *
 * Commands registered:
 *   - `bundle <path>`  — process a bundle directory
 *   - `list <path>`    — list bundle contents or repomix file entries
 *   - `repomix [...args]` — forward raw arguments to the repomix CLI dependency
 *   - `init`           — create default configuration files
 *   - `cleanup <path>` — remove generated metadata files
 */
export function registerRepomixCommands(cli: CAC): void {
  // ── bundle ──────────────────────────────────────────────────────────────
  cli
    .command('bundle <path>', 'Process a bundle directory: compute SHA-256 digests, write manifest.json and SHA256SUMS')
    .option('--zip', 'Create a ZIP archive of the completed bundle', { default: false })
    .option('--zip-output <path>', 'Output path for the ZIP archive (implies --zip)')
    .option('--exclude <pattern>', 'Glob pattern to exclude; may be repeated')
    .example('  cx bundle ./my-bundle')
    .example('  cx bundle ./my-bundle --zip')
    .example('  cx bundle ./my-bundle --zip --zip-output ./dist/bundle.zip')
    .action(
      action(
        (
          bundlePath: string,
          opts: { zip: boolean; zipOutput?: string; exclude?: string | string[] },
        ) => {
          const exclude =
            opts.exclude === undefined
              ? undefined
              : Array.isArray(opts.exclude)
                ? opts.exclude
                : [opts.exclude];
          return runBundle(bundlePath, {
            zip: opts.zip || opts.zipOutput !== undefined,
            ...(opts.zipOutput !== undefined && { zipOutput: opts.zipOutput }),
            ...(exclude !== undefined && { exclude }),
          });
        },
      ),
    );

  // ── list ─────────────────────────────────────────────────────────────────
  cli
    .command('list <path>', 'List files in a bundle directory or entries in a repomix output file')
    .option('--verbose', 'Show SHA-256 digests, sizes, and line counts', { default: false })
    .example('  cx list ./my-bundle')
    .example('  cx list ./my-bundle/repomix-output.xml --verbose')
    .action(action((targetPath: string, opts: { verbose: boolean }) => runList(targetPath, opts)));

  // ── repomix ──────────────────────────────────────────────────────────────
  cli
    .command('repomix [...args]', 'Forward all arguments to the repomix CLI parser')
    .allowUnknownOptions()
    .example('  cx repomix --output bundles/repomix-output.xml')
    .example('  cx repomix --help')
    .action(action((args: string[]) => runRepomix(args)));

  // ── init ─────────────────────────────────────────────────────────────────
  cli
    .command('init', 'Create cx.json and repomix.config.json in the current directory')
    .option('--cwd <path>', 'Target directory (defaults to process.cwd())')
    .example('  cx init')
    .example('  cx init --cwd ./my-project')
    .action(action((opts: { cwd?: string }) => runInit(opts)));

  // ── cleanup ──────────────────────────────────────────────────────────────
  cli
    .command('cleanup <path>', 'Remove generated bundle metadata (manifest.json, SHA256SUMS)')
    .option('--force', 'Perform the deletion (default: dry run)', { default: false })
    .option('--zip', 'Also remove ZIP archives found in the bundle directory', { default: false })
    .example('  cx cleanup ./my-bundle')
    .example('  cx cleanup ./my-bundle --force')
    .example('  cx cleanup ./my-bundle --force --zip')
    .action(
      action((bundlePath: string, opts: { force: boolean; zip: boolean }) =>
        runCleanup(bundlePath, { force: opts.force, removeZip: opts.zip }),
      ),
    );
}
