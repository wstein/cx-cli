import path from "node:path";

import { verifyBundle } from "../../bundle/verify.js";

export interface VerifyArgs {
  bundleDir: string;
  againstDir?: string | undefined;
}

export async function runVerifyCommand(args: VerifyArgs): Promise<number> {
  await verifyBundle(
    path.resolve(args.bundleDir),
    args.againstDir ? path.resolve(args.againstDir) : undefined,
  );
  return 0;
}
