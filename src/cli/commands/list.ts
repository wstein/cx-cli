import path from "node:path";

import { loadManifestFromBundle } from "../../bundle/validate.js";
import { getRepomixCapabilities } from "../../repomix/render.js";
import {
  selectManifestAssets,
  selectManifestSections,
  summarizeManifest,
} from "../../shared/manifestSummary.js";
import { writeJson } from "../../shared/output.js";
import { selectManifestRows } from "../../shared/verifyFilters.js";

export interface ListArgs {
  bundleDir: string;
  json: boolean;
  sections?: string[] | undefined;
  files?: string[] | undefined;
}

export async function runListCommand(args: ListArgs): Promise<number> {
  const { manifest, manifestName } = await loadManifestFromBundle(
    path.resolve(args.bundleDir),
  );
  const rows = selectManifestRows(manifest.files, {
    sections: args.sections,
    files: args.files,
  });
  const sections = selectManifestSections(manifest, rows);
  const assets = selectManifestAssets(manifest, rows);

  if (args.json) {
    writeJson({
      summary: summarizeManifest(manifestName, manifest, rows),
      repomix: await getRepomixCapabilities(),
      settings: manifest.settings,
      selection: {
        sections: args.sections ?? [],
        files: args.files ?? [],
      },
      sections,
      assets,
      files: rows,
    });
    return 0;
  }

  const lines = [
    `manifest: ${manifestName}`,
    "kind\tsection\tstored_in\tpath",
    ...rows.map(
      (file) => `${file.kind}\t${file.section}\t${file.storedIn}\t${file.path}`,
    ),
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
  return 0;
}
