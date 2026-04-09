#!/usr/bin/env node
/**
 * cx — repomix umbrella CLI
 *
 * Commands:
 *   cx bundle <path>   — Scan a bundle folder and write manifest + SHA256SUMS
 *   cx list   <path>   — List source files inside repomix output(s)
 *   cx init            — Scaffold repomix.config.json and cx.json
 *   cx cleanup <path>  — Remove cx-generated artefacts from a bundle folder
 */

import { cac } from 'cac';

import { runBundle } from '../commands/bundle.js';
import { runCleanup } from '../commands/cleanup.js';
import { runInit } from '../commands/init.js';
import { runList } from '../commands/list.js';

const cli = cac('cx');

// ---------------------------------------------------------------------------
// cx bundle <path>
// ---------------------------------------------------------------------------
cli
  .command('bundle <path>', 'Scan a bundle folder and write manifest.json + SHA256SUMS')
  .option('--zip', 'Also create a <folder>.bundle.zip archive')
  .option('-q, --quiet', 'Suppress informational output')
  .example('cx bundle ./my-bundle')
  .example('cx bundle ./my-bundle --zip')
  .action(async (bundlePath: string, opts: { zip?: boolean; quiet?: boolean }) => {
    await runBundle(bundlePath, { zip: opts.zip, quiet: opts.quiet }).catch(
      fatal,
    );
  });

// ---------------------------------------------------------------------------
// cx list <path>
// ---------------------------------------------------------------------------
cli
  .command('list <path>', 'List source files recorded inside repomix output(s)')
  .option('--plain', 'One path per line, no decoration (useful for piping)')
  .option('-q, --quiet', 'Suppress totals and headers')
  .example('cx list ./my-bundle')
  .example('cx list ./my-bundle/repomix-output.xml')
  .example('cx list ./my-bundle --plain')
  .action(async (target: string, opts: { plain?: boolean; quiet?: boolean }) => {
    await runList(target, { plain: opts.plain, quiet: opts.quiet }).catch(
      fatal,
    );
  });

// ---------------------------------------------------------------------------
// cx init
// ---------------------------------------------------------------------------
cli
  .command('init', 'Scaffold repomix.config.json and cx.json in the current directory')
  .option('--ts', 'Generate cx.ts instead of cx.json')
  .option('--force', 'Overwrite existing config files')
  .option('--cwd <dir>', 'Target directory (default: current working directory)')
  .option('-q, --quiet', 'Suppress informational output')
  .example('cx init')
  .example('cx init --ts')
  .example('cx init --force')
  .action(
    async (opts: { ts?: boolean; force?: boolean; cwd?: string; quiet?: boolean }) => {
      await runInit({ ts: opts.ts, force: opts.force, cwd: opts.cwd, quiet: opts.quiet }).catch(
        fatal,
      );
    },
  );

// ---------------------------------------------------------------------------
// cx cleanup <path>
// ---------------------------------------------------------------------------
cli
  .command('cleanup <path>', 'Remove cx-generated artefacts from a bundle folder')
  .option('--zip', 'Also remove the <folder>.bundle.zip archive')
  .option('--zip-name <name>', 'Name of a specific ZIP file to remove')
  .option('-q, --quiet', 'Suppress informational output')
  .example('cx cleanup ./my-bundle')
  .example('cx cleanup ./my-bundle --zip')
  .action(
    async (
      bundlePath: string,
      opts: { zip?: boolean; zipName?: string; quiet?: boolean },
    ) => {
      await runCleanup(bundlePath, {
        zip: opts.zip,
        zipName: opts.zipName,
        quiet: opts.quiet,
      }).catch(fatal);
    },
  );

// ---------------------------------------------------------------------------
// Global options and help
// ---------------------------------------------------------------------------
cli.help();
cli.version('0.1.0');
cli.parse();

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------
function fatal(err: unknown): never {
  const message =
    err instanceof Error ? err.message : String(err);
  console.error(`\nError: ${message}`);
  process.exit(1);
}
