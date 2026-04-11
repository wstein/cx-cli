import path from "node:path";

import {
  loadManifestFromBundle,
  validateBundle,
} from "../../bundle/validate.js";
import { getRepomixCapabilities } from "../../repomix/render.js";
import { summarizeManifest } from "../../shared/manifestSummary.js";
import { writeJson } from "../../shared/output.js";

export interface ValidateArgs {
  bundleDir: string;
  json?: boolean | undefined;
}

export async function runValidateCommand(args: ValidateArgs): Promise<number> {
  const bundleDir = path.resolve(args.bundleDir);
  const { manifestName } = await validateBundle(bundleDir);
  if (args.json ?? false) {
    const { manifest } = await loadManifestFromBundle(bundleDir);
    writeJson({
      bundleDir,
      summary: summarizeManifest(manifestName, manifest),
      checksumFile: manifest.checksumFile,
      sourceRoot: manifest.sourceRoot,
      bundleVersion: manifest.bundleVersion,
      schemaVersion: manifest.schemaVersion,
      repomix: await getRepomixCapabilities(),
      valid: true,
    });
  }
  return 0;
}
