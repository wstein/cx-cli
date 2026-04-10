import fs from 'node:fs/promises';
import path from 'node:path';

import { loadCxConfig } from '../../config/load.js';
import { buildBundlePlan } from '../../planning/buildPlan.js';
import { ensureDir } from '../../shared/fs.js';
import { renderSectionWithRepomix } from '../../repomix/render.js';
import { sha256File } from '../../shared/hashing.js';
import { buildManifest } from '../../manifest/build.js';
import { renderManifestToon } from '../../manifest/toon.js';
import { writeChecksumFile } from '../../manifest/checksums.js';
import { CX_VERSION, REPOMIX_VERSION } from '../../repomix/render.js';
import { validateBundle } from '../../bundle/validate.js';

export interface BundleArgs {
  config: string;
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
  await fs.writeFile(path.join(plan.bundleDir, manifestName), renderManifestToon(manifest), 'utf8');
  await writeChecksumFile(
    plan.bundleDir,
    plan.checksumFile,
    [
      manifestName,
      ...plan.sections.map((section) => section.outputFile),
      ...plan.assets.map((asset) => asset.storedPath),
    ],
  );

  await validateBundle(plan.bundleDir);
  return 0;
}
