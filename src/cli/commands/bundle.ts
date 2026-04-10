import fs from "node:fs/promises";
import path from "node:path";
import { validateBundle } from "../../bundle/validate.js";
import { loadCxConfig } from "../../config/load.js";
import { buildManifest } from "../../manifest/build.js";
import { writeChecksumFile } from "../../manifest/checksums.js";
import { renderManifestToon } from "../../manifest/toon.js";
import { buildBundlePlan } from "../../planning/buildPlan.js";
import type { PlannedSourceFile } from "../../planning/types.js";
import {
  CX_VERSION,
  getRepomixCapabilities,
  REPOMIX_VERSION,
  renderSectionWithRepomix,
} from "../../repomix/render.js";
import { ensureDir } from "../../shared/fs.js";
import { sha256File } from "../../shared/hashing.js";
import { writeJson } from "../../shared/output.js";

export interface BundleArgs {
  config: string;
  json?: boolean | undefined;
}

function supportsLosslessExtraction(
  style: "xml" | "markdown" | "json" | "plain",
  files: PlannedSourceFile[],
): boolean {
  if (style === "plain") {
    const ambiguousPattern =
      /(?:^|\n)================\nFile: .+\n================(?:\n|$)/;
    return !files.some((file) =>
      ambiguousPattern.test(file.trimmedContent ?? ""),
    );
  }

  return true;
}

export async function runBundleCommand(args: BundleArgs): Promise<number> {
  const config = await loadCxConfig(args.config);
  const plan = await buildBundlePlan(config);
  await ensureDir(plan.bundleDir);

  for (const asset of plan.assets) {
    const destination = path.join(plan.bundleDir, asset.storedPath);
    await ensureDir(path.dirname(destination));
    await fs.copyFile(asset.absolutePath, destination);
  }

  const sectionOutputs = [];
  for (const section of plan.sections) {
    const outputPath = path.join(plan.bundleDir, section.outputFile);
    const outputText = await renderSectionWithRepomix({
      config,
      style: section.style,
      sourceRoot: plan.sourceRoot,
      outputPath,
      explicitFiles: section.files.map((file) => file.absolutePath),
    });
    sectionOutputs.push({
      name: section.name,
      style: section.style,
      outputFile: section.outputFile,
      outputSha256: await sha256File(outputPath),
      fileCount: section.files.length,
      losslessTextExtraction: supportsLosslessExtraction(
        section.style,
        section.files,
      ),
    });
    void outputText;
  }

  const manifest = buildManifest({
    config,
    plan,
    sectionOutputs,
    cxVersion: CX_VERSION,
    repomixVersion: REPOMIX_VERSION,
  });
  const manifestName = `${plan.projectName}-manifest.toon`;
  await fs.writeFile(
    path.join(plan.bundleDir, manifestName),
    renderManifestToon(manifest),
    "utf8",
  );
  await writeChecksumFile(plan.bundleDir, plan.checksumFile, [
    manifestName,
    ...plan.sections.map((section) => section.outputFile),
    ...plan.assets.map((asset) => asset.storedPath),
  ]);

  await validateBundle(plan.bundleDir);
  if (args.json ?? false) {
    writeJson({
      projectName: plan.projectName,
      bundleDir: plan.bundleDir,
      manifestName,
      checksumFile: plan.checksumFile,
      sectionCount: plan.sections.length,
      assetCount: plan.assets.length,
      unmatchedCount: plan.unmatchedFiles.length,
      repomix: getRepomixCapabilities(),
    });
  }
  return 0;
}
