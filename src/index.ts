#!/usr/bin/env node

/**
 * cx — umbrella CLI for code context tooling.
 *
 * Entry point: wires up the `cac` application and delegates command
 * registration to dedicated modules.
 */

import process from 'node:process';
import { cac } from 'cac';
import { registerRepomixCommands } from './cli/repomix-commands.js';

const cli = cac('cx');

cli.version('0.1.0');
cli.help();

registerRepomixCommands(cli);

cli.parse(process.argv);
