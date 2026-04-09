/**
 * `cx repomix [...args]` — forward all arguments directly to the repomix CLI.
 *
 * This command bypasses cx-specific parsing for repomix options and passes the
 * user arguments unchanged to the repomix executable that is installed as a
 * dependency.
 */

import process from 'node:process';
import kleur from 'kleur';
import * as repomix from 'repomix';

/**
 * Execute the `repomix` command by calling the installed repomix module
 * directly, preserving the exact argument list.
 */
export async function runRepomix(args: string[]): Promise<void> {
  console.log(kleur.cyan(`Running repomix: ${['repomix', ...args].join(' ')}`));

  const originalArgv = process.argv;
  const nodePath = originalArgv[0] ?? process.execPath;
  process.argv = [nodePath, 'repomix', ...args];

  try {
    await repomix.cli();
  } finally {
    process.argv = originalArgv;
  }
}
