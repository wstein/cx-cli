import fs from 'node:fs/promises';

import { DEFAULT_CONFIG_TEMPLATE } from '../../config/defaults.js';
import { pathExists } from '../../shared/fs.js';
import { CxError } from '../../shared/errors.js';

export interface InitArgs {
  force: boolean;
  name: string | undefined;
  stdout: boolean;
  style: 'xml' | 'markdown' | 'json' | 'plain' | undefined;
}

export async function runInitCommand(args: InitArgs): Promise<number> {
  let output = DEFAULT_CONFIG_TEMPLATE;

  if (args.name) {
    output = output.replace('project_name = "myproject"', `project_name = "${args.name}"`);
    output = output.replace('output_dir = "dist/myproject-bundle"', `output_dir = "dist/${args.name}-bundle"`);
  }

  if (args.style) {
    output = output.replace('style = "xml"', `style = "${args.style}"`);
  }

  if (args.stdout) {
    process.stdout.write(output);
    return 0;
  }

  if (!args.force && await pathExists('cx.toml')) {
    throw new CxError('cx.toml already exists. Use --force to overwrite it.', 3);
  }

  await fs.writeFile('cx.toml', output, 'utf8');
  return 0;
}
