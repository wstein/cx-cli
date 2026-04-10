import path from "node:path";

import { loadManifestFromBundle } from "../../bundle/validate.js";
import { extractBundle } from "../../extract/extract.js";
import {
  selectManifestAssets,
  selectManifestSections,
  summarizeManifest,
} from "../../shared/manifestSummary.js";
import { writeJson } from "../../shared/output.js";
import { selectManifestRows } from "../../shared/verifyFilters.js";

export interface ExtractArgs {
  bundleDir: string;
  destinationDir: string;
  sections: string[] | undefined;
  files: string[] | undefined;
  assetsOnly: boolean;
  overwrite: boolean;
  verify: boolean;
  json?: boolean | undefined;
}

export async function runExtractCommand(args: ExtractArgs): Promise<number> {
  const bundleDir = path.resolve(args.bundleDir);
  const destinationDir = path.resolve(args.destinationDir);
  const { manifest, manifestName } = await loadManifestFromBundle(bundleDir);
  const rows = selectManifestRows(manifest.files, {
    sections: args.sections,
    files: args.files,
  }).filter((row) => !args.assetsOnly || row.kind === "asset");

  await extractBundle({
    bundleDir,
    destinationDir,
    sections: args.sections,
    files: args.files,
    assetsOnly: args.assetsOnly,
    overwrite: args.overwrite,
    verify: args.verify,
  });
  if (args.json ?? false) {
    writeJson({
      bundleDir,
      destinationDir,
      selection: {
        sections: args.sections ?? [],
        files: args.files ?? [],
      },
      assetsOnly: args.assetsOnly,
      extractedSections: selectManifestSections(manifest, rows).map(
        (section) => section.name,
      ),
      extractedAssets: selectManifestAssets(manifest, rows).map(
        (asset) => asset.sourcePath,
      ),
      extractedFiles: rows.map((row) => row.path),
      summary: summarizeManifest(manifestName, manifest, rows),
      verify: args.verify,
    });
  }
  return 0;
}
