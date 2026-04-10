import path from 'node:path';

import { validateBundle } from '../../bundle/validate.js';

export interface ValidateArgs {
  bundleDir: string;
}

export async function runValidateCommand(args: ValidateArgs): Promise<number> {
  await validateBundle(path.resolve(args.bundleDir));
  return 0;
}
