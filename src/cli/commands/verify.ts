import path from "node:path";

import { verifyBundle } from "../../bundle/verify.js";

export interface VerifyArgs {
  bundleDir: string;
}

export async function runVerifyCommand(args: VerifyArgs): Promise<number> {
  await verifyBundle(path.resolve(args.bundleDir));
  return 0;
}
