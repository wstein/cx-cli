import { loadManifestFromBundle, validateBundle } from "../../bundle/validate.js";
import { loadCxConfig } from "../../config/load.js";
import { resolveExtractability } from "../../extract/resolution.js";
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
    let bundleComparison:
      | {
          available: true;
          bundleDir: string;
          manifestName: string;
        }
      | {
          available: false;
          bundleDir: string;
          reason: string;
        };
    let extractabilityByPath = new Map<
      string,
      {
        status: string;
        reason: string;
        message: string;
      }
    >();

    try {
      const { manifestName } = await validateBundle(plan.bundleDir);
      const { manifest } = await loadManifestFromBundle(plan.bundleDir);
      if (
        manifest.projectName !== plan.projectName ||
        manifest.sourceRoot !== plan.sourceRoot
      ) {
        bundleComparison = {
          available: false,
          bundleDir: plan.bundleDir,
          reason: "Existing bundle does not match the current plan.",
        };
      } else {
        const resolution = await resolveExtractability({
          bundleDir: plan.bundleDir,
          manifest,
          rows: manifest.files,
        });
        extractabilityByPath = new Map(
          resolution.records.map((record) => [
            record.path,
            {
              status: record.status,
              reason: record.reason,
              message: record.message,
            },
          ]),
        );
        bundleComparison = {
          available: true,
          bundleDir: plan.bundleDir,
          manifestName,
        };
      }
    } catch (error) {
      bundleComparison = {
        available: false,
        bundleDir: plan.bundleDir,
        reason: error instanceof Error ? error.message : String(error),
      };
    }

    writeJson({
      summary: buildInspectSummary(plan),
      repomix: await getRepomixCapabilities(),
      bundleComparison,
      sections: plan.sections.map((section) => ({
        ...section,
        files: section.files.map((file) => ({
          ...file,
          extractability: extractabilityByPath.get(file.relativePath) ?? null,
        })),
      })),
      assets: plan.assets.map((asset) => ({
        ...asset,
        extractability: extractabilityByPath.get(asset.relativePath) ?? null,
      })),
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
