/**
 * repomix-commands.ts — registration of repomix bundle commands for cx CLI
 *
 * Framework: cac (https://github.com/cacjs/cac)
 * For other CLI frameworks see the notes at the bottom of this file.
 *
 * Usage (in your cli entry point):
 *
 *   import { cac } from 'cac';
 *   import { registerRepomixCommands } from './repomix-commands.js';
 *
 *   const cli = cac('cx');
 *   registerRepomixCommands(cli);
 *   cli.help();
 *   cli.parse();
 */

import type { CAC } from 'cac';
import { bundleCommand } from '../commands/bundle.js';
import { listCommand } from '../commands/list.js';
import { initCommand } from '../commands/init.js';
import { cleanupCommand } from '../commands/cleanup.js';

export function registerRepomixCommands(cli: CAC): void {
  // cx bundle <bundle-path> [--zip [name]]
  cli
    .command('bundle <bundle-path>', 'Scan a bundle folder and write manifest.json + SHA256SUMS')
    .option('--zip [name]', 'Also create a zip archive (optional custom name)')
    .action((bundlePath: string, opts: { zip?: boolean | string }) => {
      bundleCommand(bundlePath, { zip: opts.zip }).catch((err: unknown) => {
        console.error(String(err));
        process.exit(1);
      });
    });

  // cx list <target>
  cli
    .command('list <target>', 'List files contained in a repomix output file')
    .action((target: string) => {
      listCommand(target).catch((err: unknown) => {
        console.error(String(err));
        process.exit(1);
      });
    });

  // cx init [--ts]
  cli
    .command('init', 'Initialise a cx project (creates cx.json and repomix.config.json)')
    .option('--ts', 'Create cx.ts instead of cx.json')
    .action((opts: { ts?: boolean }) => {
      initCommand({ ts: opts.ts }).catch((err: unknown) => {
        console.error(String(err));
        process.exit(1);
      });
    });

  // cx cleanup <bundle-path> [--zip-name <name>] [--all-zips]
  cli
    .command('cleanup <bundle-path>', 'Remove generated files from a bundle folder')
    .option('--zip-name <name>', 'Also remove the named zip file')
    .option('--all-zips', 'Remove all *.zip files in the bundle folder')
    .action((bundlePath: string, opts: { zipName?: string; allZips?: boolean }) => {
      cleanupCommand(bundlePath, { zipName: opts.zipName, allZips: opts.allZips }).catch(
        (err: unknown) => {
          console.error(String(err));
          process.exit(1);
        },
      );
    });
}

/*
 * Framework-agnostic note
 * -----------------------
 * The four command handlers (bundleCommand, listCommand, initCommand, cleanupCommand)
 * are plain async functions that accept a path string + options object. They can be
 * wired into any CLI framework:
 *
 * yargs:
 *   yargs.command('bundle <bundlePath>', '...', (y) => y.option('zip', {...}),
 *     (argv) => bundleCommand(argv.bundlePath, argv));
 *
 * commander:
 *   program.command('bundle <bundlePath>').option('--zip [name]')
 *     .action((bundlePath, opts) => bundleCommand(bundlePath, opts));
 */
