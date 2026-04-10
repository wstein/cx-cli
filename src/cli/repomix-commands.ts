/**
 * Register all repomix-bundle commands with a `yargs` CLI application.
 *
 * This module defines the public command surface and delegates the actual
 * behavior to the shared command handlers in `../commands/*`.
 */

import kleur from 'kleur';
import type { Argv, Arguments } from 'yargs';
import { runBundle } from '../commands/bundle.js';
import { runCleanup } from '../commands/cleanup.js';
import { runInit } from '../commands/init.js';
import { runList } from '../commands/list.js';
import { runRepomix } from '../commands/repomix.js';
import { runRepomixSections } from '../commands/repomixSections.js';

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------

/**
 * Wrap a command action so that any thrown error is printed and the process
 * exits with code 1.
 */
function action<T extends Arguments>(fn: (args: T) => Promise<void>) {
  return async (args: T): Promise<void> => {
    try {
      await fn(args);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(kleur.red(`Error: ${message}`));
      process.exitCode = 1;
    }
  };
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

/**
 * Register the repomix-bundle commands with the provided `yargs` instance.
 */
export function registerRepomixCommands(cli: Argv, version: string): Argv {
  return cli
    .scriptName('cx')
    .command(
      'help',
      'Show CLI help',
      () => {},
      () => {
        cli.showHelp();
      },
    )
    .command(
      'version',
      'Show CLI version',
      () => {},
      () => {
        console.log(version);
      },
    )
    .command(
      'bundle [path]',
      'Process a bundle directory (defaults to current working directory): compute SHA-256 digests, write manifest.json and SHA256SUMS',
      (command: any) =>
        command
          .option('zip', {
            type: 'boolean',
            describe: 'Create a ZIP archive of the completed bundle',
            default: false,
          })
          .option('zip-output', {
            type: 'string',
            describe: 'Output path for the ZIP archive (implies --zip)',
          })
          .option('exclude', {
            type: 'string',
            array: true,
            describe: 'Glob pattern to exclude; may be repeated',
          })
          .option('verbose', {
            type: 'boolean',
            describe: 'Print detailed bundle diagnostics',
            default: false,
          })
          .option('sections', {
            type: 'boolean',
            describe: 'Generate repomix section outputs from cx.json before bundling',
            default: false,
          })
          .option('cx-config', {
            type: 'string',
            describe: 'CX configuration file',
            default: 'cx.json',
          })
          .option('repomix-config', {
            type: 'string',
            describe: 'Repomix configuration file',
          })
          .option('section-checksum-file', {
            type: 'string',
            describe: 'Checksum file path for generated section outputs',
          })
          .option('section-verbose', {
            type: 'boolean',
            describe: 'Show verbose progress during section generation',
            default: false,
          })
          .example('cx bundle')
          .example('cx bundle ./my-bundle --zip')
          .example('cx bundle ./my-bundle --sections'),
      action(async (argv: any) => {
        const args: any = argv;
        const exclude = args.exclude === undefined
          ? undefined
          : Array.isArray(args.exclude)
            ? args.exclude.map(String)
            : [String(args.exclude)];

        return runBundle(args.path as string | undefined, {
          zip: args.zip as boolean || args.zipOutput !== undefined,
          ...(args.zipOutput !== undefined && { zipOutput: args.zipOutput as string }),
          ...(exclude !== undefined && { exclude }),
          verbose: args.verbose as boolean,
          sections: args.sections as boolean,
          cxConfig: args.cxConfig as string,
          ...(args.repomixConfig !== undefined && { repomixConfig: args.repomixConfig as string }),
          ...(args.sectionChecksumFile !== undefined && { sectionChecksumFile: args.sectionChecksumFile as string }),
          sectionVerbose: args.sectionVerbose as boolean,
        });
      }),
    )
    .command(
      'list <path>',
      'List files in a bundle directory or entries in a repomix output file',
      (command: any) =>
        command
          .option('verbose', {
            type: 'boolean',
            describe: 'Show SHA-256 digests, sizes, and line counts',
            default: false,
          })
          .example('cx list ./my-bundle')
          .example('cx list ./my-bundle/repomix-output.xml.txt --verbose'),
      action(async (argv: any) => runList(argv.path as string, { verbose: argv.verbose as boolean })),
    )
    .command(
      'repomix [args..]',
      'Forward all arguments to the repomix CLI parser',
      (command: any) =>
        command
          .parserConfiguration({ 'unknown-options-as-args': true })
          .positional('args', {
            type: 'string',
            array: true,
            default: [],
            describe: 'Arguments forwarded to the repomix CLI',
          })
          .example('cx repomix --output bundles/repomix-output.xml.txt')
          .example('cx repomix --help'),
      action(async (argv: any) => runRepomix(argv.args as string[])),
    )
    .command(
      'init',
      'Create cx.json and repomix.config.json in the current directory',
      (command: any) =>
        command
          .option('cwd', {
            type: 'string',
            describe: 'Target directory (defaults to process.cwd())',
          })
          .example('cx init')
          .example('cx init --cwd ./my-project'),
      action(async (argv: any) =>
        runInit(argv.cwd !== undefined ? { cwd: argv.cwd as string } : {}),
      ),
    )
    .command(
      'repomix-components',
      'Generate one repomix output file per component from cx.json sections',
      (command: any) =>
        command
          .option('cx-config', {
            type: 'string',
            describe: 'CX configuration file',
            default: 'cx.json',
          })
          .option('config', {
            type: 'string',
            describe: 'Repomix configuration file',
          })
          .option('output-dir', {
            type: 'string',
            describe: 'Directory for generated component outputs',
            default: 'bundles',
          })
          .option('checksum-file', {
            type: 'string',
            describe: 'Checksum file path',
          })
          .option('verbose', {
            type: 'boolean',
            describe: 'Show the repomix command line for each component',
            default: false,
          })
          .example('cx repomix-components')
          .example('cx repomix-components --cx-config ./cx.json --config ./repomix.config.json'),
      action(async (argv: any) =>
        runRepomixSections({
          cxConfig: argv.cxConfig as string,
          ...(argv.config !== undefined && { config: argv.config as string }),
          outputDir: argv.outputDir as string,
          ...(argv.checksumFile !== undefined && { checksumFile: argv.checksumFile as string }),
          verbose: argv.verbose as boolean,
        }),
      ),
    )
    .command(
      'cleanup <path>',
      'Remove generated bundle metadata (manifest.json, SHA256SUMS)',
      (command: any) =>
        command
          .option('force', {
            type: 'boolean',
            describe: 'Perform the deletion (default: dry run)',
            default: false,
          })
          .option('zip', {
            type: 'boolean',
            describe: 'Also remove ZIP archives found in the bundle directory',
            default: false,
          })
          .example('cx cleanup ./my-bundle')
          .example('cx cleanup ./my-bundle --force')
          .example('cx cleanup ./my-bundle --force --zip'),
      action(async (argv: any) =>
        runCleanup(argv.path as string, { force: argv.force as boolean, removeZip: argv.zip as boolean }),
      ),
    );
}
