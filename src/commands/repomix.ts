/**
 * `cx repomix [...args]` — forward all arguments directly to the repomix CLI.
 *
 * This command bypasses cx-specific parsing for repomix options and passes the
 * user arguments unchanged to the repomix executable that is installed as a
 * dependency.
 */

import process from 'node:process';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import kleur from 'kleur';

const require = createRequire(import.meta.url);

/**
 * Resolve the local repomix CLI entrypoint from the installed dependency.
 */
export async function resolveRepomixEntryPoint(): Promise<string> {
  const repomixMain = require.resolve('repomix');
  let packageDir = dirname(repomixMain);
  while (true) {
    const candidate = `${packageDir}/package.json`;
    try {
      await readFile(candidate, 'utf8');
      break;
    } catch {
      const parent = dirname(packageDir);
      if (parent === packageDir) {
        throw new Error('Unable to locate repomix package metadata.');
      }
      packageDir = parent;
    }
  }

  const pkgJsonPath = `${packageDir}/package.json`;
  const pkgJsonContent = await readFile(pkgJsonPath, 'utf8');
  const pkgJson = JSON.parse(pkgJsonContent) as { bin?: string | Record<string, string> };

  let relativeBin: string | undefined;

  if (typeof pkgJson.bin === 'string') {
    relativeBin = pkgJson.bin;
  } else if (typeof pkgJson.bin === 'object' && pkgJson.bin !== null) {
    const binEntry = pkgJson.bin['repomix'];
    relativeBin = typeof binEntry === 'string' ? binEntry : undefined;

    if (!relativeBin) {
      const entries = Object.values(pkgJson.bin);
      if (entries.length === 1 && typeof entries[0] === 'string') {
        relativeBin = entries[0];
      }
    }
  }

  if (!relativeBin) {
    throw new Error('Unable to resolve the repomix CLI entrypoint from the installed dependency.');
  }

  const entryPointUrl = new URL(relativeBin, pathToFileURL(packageDir + '/'));
  return fileURLToPath(entryPointUrl);
}

/**
 * Execute the `repomix` command by spawning the local repomix CLI with the
 * given arguments.
 */
export async function runRepomix(args: string[]): Promise<void> {
  const entryPoint = await resolveRepomixEntryPoint();

  console.log(kleur.cyan(`Running repomix: ${['repomix', ...args].join(' ')}`));

  const child = spawn(process.execPath, [entryPoint, ...args], {
    stdio: 'inherit',
    windowsHide: true,
  });

  await new Promise<void>((resolve, reject) => {
    child.on('error', (err) => reject(err));
    child.on('close', (code, signal) => {
      if (signal) {
        reject(new Error(`repomix terminated by signal ${signal}`));
        return;
      }
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`repomix exited with code ${code ?? 'unknown'}`));
    });
  });
}
