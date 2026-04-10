import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';

import { runInitCommand } from './commands/init.js';
import { runInspectCommand } from './commands/inspect.js';
import { asError, CxError } from '../shared/errors.js';

export async function main(argv: string[]): Promise<number> {
  let exitCode = 0;

  await yargs(hideBin(['node', 'cx', ...argv]))
    .scriptName('cx')
    .strict()
    .help()
    .exitProcess(false)
    .fail((message, error) => {
      throw error ?? new CxError(message || 'Command failed.');
    })
    .command(
      'init',
      'Create a starter cx.toml.',
      (command) => command
        .option('force', { type: 'boolean', default: false })
        .option('name', { type: 'string' })
        .option('stdout', { type: 'boolean', default: false })
        .option('style', { choices: ['xml', 'markdown', 'json', 'plain'] as const }),
      async (args) => {
        exitCode = await runInitCommand({
          force: args.force,
          name: args.name,
          stdout: args.stdout,
          style: args.style,
        });
      },
    )
    .command(
      'inspect',
      'Show the computed plan without writing files.',
      (command) => command
        .option('config', { type: 'string', default: 'cx.toml' })
        .option('json', { type: 'boolean', default: false }),
      async (args) => {
        exitCode = await runInspectCommand({
          config: args.config,
          json: args.json,
        });
      },
    )
    .demandCommand(1)
    .parseAsync();

  return exitCode;
}

if (import.meta.main) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      const resolved = asError(error);
      process.stderr.write(`${resolved.message}\n`);
      process.exitCode = resolved instanceof CxError ? resolved.exitCode : 1;
    });
}
