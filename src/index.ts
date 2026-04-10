#!/usr/bin/env node

/**
 * cx — umbrella CLI for code context tooling.
 *
 * Entry point: wires up the `yargs` application and delegates command
 * registration to dedicated modules.
 */

import kleur from 'kleur';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { registerRepomixCommands } from './cli/repomix-commands.js';

const CLI_VERSION = '0.1.0';

registerRepomixCommands(yargs(hideBin(process.argv)), CLI_VERSION)
  .help()
  .alias('h', 'help')
  .version(CLI_VERSION)
  .alias('v', 'version')
  .strictCommands()
  .recommendCommands()
  .demandCommand(1, 'Use --help to view available commands.')
  .parse();
