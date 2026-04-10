#!/usr/bin/env node

/**
 * cx — umbrella CLI for code context tooling.
 *
 * Entry point: wires up the `cac` application and delegates command
 * registration to dedicated modules.
 */

import process from 'node:process';
import kleur from 'kleur';
import { cac } from 'cac';
import { registerRepomixCommands } from './cli/repomix-commands.js';
import { runRepomix } from './commands/repomix.js';

const cli = cac('cx');
const CLI_VERSION = '0.1.0';

cli.version(CLI_VERSION);
cli.help();

if (process.argv[2] === 'repomix') {
  void runRepomix(process.argv.slice(3)).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(kleur.red(`Error: ${message}`));
    process.exitCode = 1;
  });
} else {
  registerRepomixCommands(cli, CLI_VERSION);

  if (process.argv.length <= 2) {
    cli.outputHelp();
    process.exit(0);
  }

  cli.parse(process.argv.slice(2));
}
