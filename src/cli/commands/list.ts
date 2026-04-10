import path from "node:path";

import { loadManifestFromBundle } from "../../bundle/validate.js";

export interface ListArgs {
  bundleDir: string;
  json: boolean;
}

function buildListSummary(
  manifestName: string,
  manifest: Awaited<ReturnType<typeof loadManifestFromBundle>>["manifest"],
) {
  return {
    manifestName,
    projectName: manifest.projectName,
    sectionCount: manifest.sections.length,
    assetCount: manifest.assets.length,
    fileCount: manifest.files.length,
    textFileCount: manifest.files.filter((file) => file.kind === "text").length,
    assetFileCount: manifest.files.filter((file) => file.kind === "asset")
      .length,
  };
}

export async function runListCommand(args: ListArgs): Promise<number> {
  const { manifest, manifestName } = await loadManifestFromBundle(
    path.resolve(args.bundleDir),
  );

  if (args.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          summary: buildListSummary(manifestName, manifest),
          settings: manifest.settings,
          sections: manifest.sections,
          assets: manifest.assets,
          files: manifest.files,
        },
        null,
        2,
      )}\n`,
    );
    return 0;
  }

  const lines = [
    `manifest: ${manifestName}`,
    "kind\tsection\tstored_in\tpath",
    ...manifest.files.map(
      (file) => `${file.kind}\t${file.section}\t${file.storedIn}\t${file.path}`,
    ),
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
  return 0;
}
