#!/usr/bin/env node
/**
 * cx — repomix umbrella CLI
 *
 * Entry point. Registers all commands and parses CLI arguments.
 */

import { cac } from 'cac';
import { registerRepomixCommands } from './repomix-commands.js';

const cli = cac('cx');

registerRepomixCommands(cli);

cli
  .help()
  .version('0.1.0')
  .parse();
