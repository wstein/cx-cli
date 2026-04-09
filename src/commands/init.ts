/**
 * cx init [--ts]
 *
 * Initialises a cx project in the current directory by creating:
 *   - cx.json    (default config for the cx CLI)
 *   - repomix.config.json  (repomix configuration scaffold)
 *
 * Pass --ts to generate cx.ts instead of cx.json.
 */

import fsPromises from 'node:fs/promises';
import path from 'node:path';
import kleur from 'kleur';

export interface InitOptions {
  ts?: boolean;
}

const CX_JSON_DEFAULT = {
  $schema: 'https://raw.githubusercontent.com/wstein/cx-cli/main/schema/cx.schema.json',
  bundles: [],
  defaultOutput: 'repomix-output.xml',
};

const CX_TS_TEMPLATE = `// cx.ts — cx-cli configuration (TypeScript)
// Run: cx bundle <bundle-path>

export default {
  bundles: [] as string[],
  defaultOutput: 'repomix-output.xml',
};
`;

const REPOMIX_CONFIG_DEFAULT = {
  $schema: 'https://repomix.com/schemas/latest/schema.json',
  input: {
    include: ['**/*'],
    exclude: [
      'node_modules/**',
      'dist/**',
      '.git/**',
      '*.lock',
    ],
  },
  output: {
    style: 'xml',
    filePath: 'repomix-output.xml',
    removeComments: false,
    removeEmptyLines: false,
    showLineNumbers: false,
    copyToClipboard: false,
  },
  security: {
    enableSecurityCheck: true,
  },
};

async function writeIfAbsent(filePath: string, content: string): Promise<boolean> {
  try {
    await fsPromises.access(filePath);
    return false; // already exists
  } catch {
    await fsPromises.writeFile(filePath, content, 'utf8');
    return true;
  }
}

export async function initCommand(opts: InitOptions): Promise<void> {
  const cwd = process.cwd();

  // 1. cx config file
  if (opts.ts) {
    const cxTsPath = path.join(cwd, 'cx.ts');
    const created = await writeIfAbsent(cxTsPath, CX_TS_TEMPLATE);
    if (created) {
      console.log(kleur.green(`Created ${path.relative(cwd, cxTsPath)}`));
    } else {
      console.log(kleur.yellow(`Skipped ${path.relative(cwd, cxTsPath)} (already exists)`));
    }
  } else {
    const cxJsonPath = path.join(cwd, 'cx.json');
    const created = await writeIfAbsent(cxJsonPath, JSON.stringify(CX_JSON_DEFAULT, null, 2) + '\n');
    if (created) {
      console.log(kleur.green(`Created ${path.relative(cwd, cxJsonPath)}`));
    } else {
      console.log(kleur.yellow(`Skipped ${path.relative(cwd, cxJsonPath)} (already exists)`));
    }
  }

  // 2. repomix.config.json
  const repomixConfigPath = path.join(cwd, 'repomix.config.json');
  const created = await writeIfAbsent(
    repomixConfigPath,
    JSON.stringify(REPOMIX_CONFIG_DEFAULT, null, 2) + '\n',
  );
  if (created) {
    console.log(kleur.green(`Created ${path.relative(cwd, repomixConfigPath)}`));
  } else {
    console.log(kleur.yellow(`Skipped ${path.relative(cwd, repomixConfigPath)} (already exists)`));
  }

  console.log(kleur.bold().green('Initialised. Run `repomix` to generate output, then `cx bundle .` to create a bundle.'));
}
