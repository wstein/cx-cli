import path from "node:path";

import { extractBundle } from "../../extract/extract.js";

export interface ExtractArgs {
  bundleDir: string;
  destinationDir: string;
  sections: string[] | undefined;
  files: string[] | undefined;
  assetsOnly: boolean;
  overwrite: boolean;
  verify: boolean;
}

export async function runExtractCommand(args: ExtractArgs): Promise<number> {
  await extractBundle({
    bundleDir: path.resolve(args.bundleDir),
    destinationDir: path.resolve(args.destinationDir),
    sections: args.sections,
    files: args.files,
    assetsOnly: args.assetsOnly,
    overwrite: args.overwrite,
    verify: args.verify,
  });
  return 0;
}
