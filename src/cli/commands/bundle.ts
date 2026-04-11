import fs from "node:fs/promises";
import path from "node:path";

import { validateBundle } from "../../bundle/validate.js";
import { loadCxConfig } from "../../config/load.js";
import { buildManifest } from "../../manifest/build.js";
import { writeChecksumFile } from "../../manifest/checksums.js";
import { renderManifestToon } from "../../manifest/toon.js";
import type { SectionSpanMaps } from "../../manifest/types.js";
import { buildBundlePlan } from "../../planning/buildPlan.js";
import type { PlannedSourceFile } from "../../planning/types.js";
import {
  CX_VERSION,
  getRepomixCapabilities,
  renderSectionWithRepomix,
} from "../../repomix/render.js";
import {
  estimateTokenCount,
  formatBytes,
  formatNumber,
  printDivider,
  printHeader,
  printSubheader,
  printSuccess,
  printTable,
} from "../../shared/format.js";
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
  const sectionSpanMaps: SectionSpanMaps = new Map();

  for (const section of plan.sections) {
    const outputPath = path.join(plan.bundleDir, section.outputFile);
    const renderResult = await renderSectionWithRepomix({
      config,
      style: section.style,
      sourceRoot: plan.sourceRoot,
      outputPath,
      explicitFiles: section.files.map((file) => file.absolutePath),
    });
    const totalSectionBytes = section.files.reduce(
      (sum, file) => sum + file.sizeBytes,
      0,
    );
    const estimatedSectionTokens = section.files.reduce(
      (sum, file) => sum + estimateTokenCount(file.trimmedContent ?? ""),
      0,
    );
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
      sizeBytes: totalSectionBytes,
      estimatedTokens: estimatedSectionTokens,
    });
    if (renderResult.fileSpans) {
      sectionSpanMaps.set(section.name, renderResult.fileSpans);
    }
  }

  const manifest = buildManifest({
    config,
    plan,
    sectionOutputs,
    cxVersion: CX_VERSION,
    repomixVersion: (await getRepomixCapabilities()).packageVersion,
    sectionSpanMaps,
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

  // Calculate total statistics
  const totalAssetBytes = plan.assets.reduce(
    (sum, asset) => sum + asset.sizeBytes,
    0,
  );
  const totalSectionBytes = sectionOutputs.reduce(
    (sum, section) => sum + section.sizeBytes,
    0,
  );
  const totalTokens = sectionOutputs.reduce(
    (sum, section) => sum + section.estimatedTokens,
    0,
  );

  // Print human-friendly report
  if (!(args.json ?? false)) {
    printHeader("Bundle Summary");
    printTable([
      ["Project", plan.projectName],
      ["Location", plan.bundleDir],
    ]);
    printDivider();
    printTable([
      ["Sections", plan.sections.length],
      ["Assets", plan.assets.length],
      ["Unmatched files", plan.unmatchedFiles.length],
    ]);
    printDivider();

    // Section details
    printSubheader("Sections");
    for (const section of sectionOutputs) {
      printTable([
        [`  ${section.name}`, ""],
        ["    Files", section.fileCount],
        ["    Size", formatBytes(section.sizeBytes)],
        ["    Tokens (est.)", formatNumber(section.estimatedTokens)],
      ]);
    }

    printDivider();
    printTable([
      ["Total sections size", formatBytes(totalSectionBytes)],
      ["Total assets size", formatBytes(totalAssetBytes)],
      ["Combined", formatBytes(totalSectionBytes + totalAssetBytes)],
      ["Estimated tokens", formatNumber(totalTokens)],
    ]);
    printDivider();
    printSuccess("Bundle created successfully");
  }

  if (args.json ?? false) {
    writeJson({
      projectName: plan.projectName,
      bundleDir: plan.bundleDir,
      manifestName: `${plan.projectName}-manifest.toon`,
      checksumFile: plan.checksumFile,
      sections: sectionOutputs,
      sectionCount: plan.sections.length,
      assetCount: plan.assets.length,
      unmatchedCount: plan.unmatchedFiles.length,
      statistics: {
        totalSectionBytes,
        totalAssetBytes,
        totalBytes: totalSectionBytes + totalAssetBytes,
        estimatedTokens: totalTokens,
      },
      repomix: await getRepomixCapabilities(),
    });
  }
  return 0;
}
