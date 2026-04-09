/**
 * cx init [options]
 *
 * Scaffolds a repomix configuration file and a cx project configuration file
 * in the current working directory (or a specified directory).
 *
 * Created files:
 *  - repomix.config.json  — Repomix configuration (always)
 *  - cx.json (default) or cx.ts (with --ts flag) — cx project configuration
 */

import path from 'node:path';
import fsPromises from 'node:fs/promises';

import kleur from 'kleur';

// ---------------------------------------------------------------------------
// Default file templates
// ---------------------------------------------------------------------------

const DEFAULT_REPOMIX_CONFIG = {
  input: {
    maxFileSize: 10485760,
  },
  output: {
    filePath: 'repomix-output.xml',
    style: 'xml',
    parsableStyle: true,
    fileSummary: true,
    directoryStructure: true,
    files: true,
    removeComments: false,
    removeEmptyLines: false,
    showLineNumbers: false,
    topFilesLength: 5,
    compress: false,
    copyToClipboard: false,
  },
  ignore: {
    useGitignore: true,
    useDefaultPatterns: true,
    customPatterns: [],
  },
  security: {
    enableSecurityCheck: true,
  },
} as const;

const DEFAULT_CX_JSON = {
  $schema:
    'https://raw.githubusercontent.com/wstein/cx-cli/main/schema/cx.schema.json',
  version: '1',
  bundle: {
    includeHidden: false,
    exclude: ['node_modules/**', '.git/**'],
  },
} as const;

const DEFAULT_CX_TS_CONTENT = `import { defineConfig } from 'cx-cli';

export default defineConfig({
  bundle: {
    includeHidden: false,
    exclude: ['node_modules/**', '.git/**'],
  },
});
`;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface InitOptions {
  /** Target directory for the generated files (default: process.cwd()). */
  cwd?: string;
  /** Generate cx.ts instead of cx.json. */
  ts?: boolean;
  /** Overwrite existing config files without prompting. */
  force?: boolean;
  /** Suppress output. */
  quiet?: boolean;
}

export interface InitResult {
  /** Paths of files that were created. */
  created: string[];
  /** Paths of files that were skipped because they already existed. */
  skipped: string[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Executes the `init` command.
 *
 * @param opts  Command options.
 * @returns     Summary of created and skipped files.
 */
export async function runInit(opts: InitOptions = {}): Promise<InitResult> {
  const cwd = opts.cwd ? path.resolve(opts.cwd) : process.cwd();
  const log = opts.quiet ? () => undefined : (msg: string) => console.log(msg);

  log(kleur.bold().cyan('Initialising cx project configuration…'));
  log(kleur.dim(`  Directory: ${cwd}`));

  const created: string[] = [];
  const skipped: string[] = [];

  // -----------------------------------------------------------------
  // repomix.config.json
  // -----------------------------------------------------------------
  const repomixConfigPath = path.join(cwd, 'repomix.config.json');
  const repomixContent = JSON.stringify(DEFAULT_REPOMIX_CONFIG, null, 2) + '\n';
  const wroteRepomix = await writeIfAbsent(
    repomixConfigPath,
    repomixContent,
    opts.force ?? false,
  );
  if (wroteRepomix) {
    created.push('repomix.config.json');
    log(kleur.green('  ✔ Created repomix.config.json'));
  } else {
    skipped.push('repomix.config.json');
    log(kleur.yellow('  ⚠ Skipped repomix.config.json (already exists — use --force to overwrite)'));
  }

  // -----------------------------------------------------------------
  // cx.json or cx.ts
  // -----------------------------------------------------------------
  if (opts.ts) {
    const cxTsPath = path.join(cwd, 'cx.ts');
    const wrote = await writeIfAbsent(cxTsPath, DEFAULT_CX_TS_CONTENT, opts.force ?? false);
    if (wrote) {
      created.push('cx.ts');
      log(kleur.green('  ✔ Created cx.ts'));
    } else {
      skipped.push('cx.ts');
      log(kleur.yellow('  ⚠ Skipped cx.ts (already exists — use --force to overwrite)'));
    }
  } else {
    const cxJsonPath = path.join(cwd, 'cx.json');
    const cxContent = JSON.stringify(DEFAULT_CX_JSON, null, 2) + '\n';
    const wrote = await writeIfAbsent(cxJsonPath, cxContent, opts.force ?? false);
    if (wrote) {
      created.push('cx.json');
      log(kleur.green('  ✔ Created cx.json'));
    } else {
      skipped.push('cx.json');
      log(kleur.yellow('  ⚠ Skipped cx.json (already exists — use --force to overwrite)'));
    }
  }

  if (!opts.quiet && created.length > 0) {
    log('');
    log(kleur.bold('Next steps:'));
    log('  1. Edit repomix.config.json to match your project layout.');
    log('  2. Run ' + kleur.cyan('npx repomix') + ' to generate repomix output.');
    log(
      '  3. Run ' +
        kleur.cyan('cx bundle <folder>') +
        ' to create the bundle manifest.',
    );
  }

  return { created, skipped };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Writes `content` to `filePath` only when the file does not already exist
 * (or when `force` is true).
 *
 * @returns true when the file was written, false when it was skipped.
 */
async function writeIfAbsent(
  filePath: string,
  content: string,
  force: boolean,
): Promise<boolean> {
  if (!force) {
    const exists = await fsPromises
      .access(filePath)
      .then(() => true)
      .catch(() => false);
    if (exists) return false;
  }
  await fsPromises.writeFile(filePath, content, 'utf8');
  return true;
}
