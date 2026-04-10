import { loadCxConfig } from "../../config/load.js";
import { buildBundlePlan } from "../../planning/buildPlan.js";
import { getRepomixCapabilities } from "../../repomix/render.js";
import { writeJson } from "../../shared/output.js";

export interface InspectArgs {
  config: string;
  json: boolean;
}

function buildInspectSummary(
  plan: Awaited<ReturnType<typeof buildBundlePlan>>,
) {
  return {
    projectName: plan.projectName,
    sourceRoot: plan.sourceRoot,
    bundleDir: plan.bundleDir,
    sectionCount: plan.sections.length,
    assetCount: plan.assets.length,
    unmatchedCount: plan.unmatchedFiles.length,
    textFileCount: plan.sections.reduce(
      (total, section) => total + section.files.length,
      0,
    ),
  };
}

export async function runInspectCommand(args: InspectArgs): Promise<number> {
  const config = await loadCxConfig(args.config ?? "cx.toml");
  const plan = await buildBundlePlan(config);

  if (args.json) {
    writeJson({
      summary: buildInspectSummary(plan),
      repomix: getRepomixCapabilities(),
      sections: plan.sections,
      assets: plan.assets,
      unmatchedFiles: plan.unmatchedFiles,
    });
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
