import path from "node:path";

import { validateBundle } from "../../bundle/validate.js";
import { getRepomixCapabilities } from "../../repomix/render.js";
import { writeJson } from "../../shared/output.js";

export interface ValidateArgs {
  bundleDir: string;
  json?: boolean | undefined;
}

export async function runValidateCommand(args: ValidateArgs): Promise<number> {
  await validateBundle(path.resolve(args.bundleDir));
  if (args.json ?? false) {
    writeJson({
      bundleDir: path.resolve(args.bundleDir),
      repomix: getRepomixCapabilities(),
      valid: true,
    });
  }
  return 0;
}
