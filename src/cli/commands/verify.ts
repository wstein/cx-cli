import path from "node:path";

import { verifyBundle } from "../../bundle/verify.js";
import { getRepomixCapabilities } from "../../repomix/render.js";
import { writeJson } from "../../shared/output.js";

export interface VerifyArgs {
  bundleDir: string;
  files?: string[] | undefined;
  json?: boolean | undefined;
  sections?: string[] | undefined;
  againstDir?: string | undefined;
}

export async function runVerifyCommand(args: VerifyArgs): Promise<number> {
  await verifyBundle(
    path.resolve(args.bundleDir),
    args.againstDir ? path.resolve(args.againstDir) : undefined,
    {
      sections: args.sections,
      files: args.files,
    },
  );
  if (args.json ?? false) {
    writeJson({
      bundleDir: path.resolve(args.bundleDir),
      againstDir: args.againstDir ? path.resolve(args.againstDir) : null,
      sections: args.sections ?? [],
      files: args.files ?? [],
      repomix: getRepomixCapabilities(),
      valid: true,
    });
  }
  return 0;
}
