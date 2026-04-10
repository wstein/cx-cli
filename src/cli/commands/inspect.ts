import { loadCxConfig } from "../../config/load.js";
import { buildBundlePlan } from "../../planning/buildPlan.js";

export interface InspectArgs {
  config: string;
  json: boolean;
}

export async function runInspectCommand(args: InspectArgs): Promise<number> {
  const config = await loadCxConfig(args.config ?? "cx.toml");
  const plan = await buildBundlePlan(config);

  if (args.json) {
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return 0;
  }

  const lines = [
    `project: ${plan.projectName}`,
    `source_root: ${plan.sourceRoot}`,
    `bundle_dir: ${plan.bundleDir}`,
    `sections: ${plan.sections.length}`,
    `assets: ${plan.assets.length}`,
    `unmatched: ${plan.unmatchedFiles.length}`,
    "",
    ...plan.sections.flatMap((section) => [
      `section ${section.name} (${section.style}) -> ${section.outputFile} [${section.files.length} files]`,
      ...section.files.map((file) => `  ${file.relativePath}`),
      "",
    ]),
    ...(plan.assets.length > 0
      ? [
          "assets",
          ...plan.assets.map(
            (asset) => `  ${asset.relativePath} -> ${asset.storedPath}`,
          ),
          "",
        ]
      : []),
    ...(plan.unmatchedFiles.length > 0
      ? ["unmatched", ...plan.unmatchedFiles.map((file) => `  ${file}`)]
      : []),
  ];

  process.stdout.write(`${lines.join("\n").trimEnd()}\n`);
  return 0;
}
