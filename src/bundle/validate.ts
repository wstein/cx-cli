import fs from "node:fs/promises";
import path from "node:path";

import { parseChecksumFile } from "../manifest/checksums.js";
import { parseManifestJson } from "../manifest/json.js";
import { CxError } from "../shared/errors.js";
import { pathExists } from "../shared/fs.js";

export async function loadManifestFromBundle(bundleDir: string): Promise<{
  manifest: ReturnType<typeof parseManifestJson>;
  manifestName: string;
}> {
  const entries = await fs.readdir(bundleDir);
  const manifestNames = entries.filter((entry) =>
    entry.endsWith("-manifest.json"),
  );
  if (manifestNames.length === 0) {
    throw new CxError("Bundle is missing a manifest file.", 2);
  }
  if (manifestNames.length > 1) {
    throw new CxError(
      `Bundle must contain exactly one manifest file, found ${manifestNames.length}.`,
      2,
    );
  }
  const manifestName = manifestNames[0];
  if (manifestName === undefined) {
    throw new CxError("Bundle is missing a manifest file.", 2);
  }

  const manifestSource = await fs.readFile(
    path.join(bundleDir, manifestName),
    "utf8",
  );
  return { manifest: parseManifestJson(manifestSource), manifestName };
}

export async function validateBundle(
  bundleDir: string,
): Promise<{ manifestName: string }> {
  const { manifest, manifestName } = await loadManifestFromBundle(bundleDir);
  if (manifest.bundleVersion !== 1) {
    throw new CxError(
      `Unsupported bundle version ${manifest.bundleVersion}. ` +
        "This version of cx supports bundle version 1.",
      2,
    );
  }

  for (const section of manifest.sections) {
    if (!(await pathExists(path.join(bundleDir, section.outputFile)))) {
      throw new CxError(
        `Bundle is missing section output ${section.outputFile}.`,
        2,
      );
    }
  }

  if (
    manifest.bundleIndexFile &&
    !(await pathExists(path.join(bundleDir, manifest.bundleIndexFile)))
  ) {
    throw new CxError(
      `Bundle is missing bundle index ${manifest.bundleIndexFile}.`,
      2,
    );
  }

  for (const asset of manifest.assets) {
    if (!(await pathExists(path.join(bundleDir, asset.storedPath)))) {
      throw new CxError(`Bundle is missing asset ${asset.storedPath}.`, 2);
    }
  }

  const checksumPath = path.join(bundleDir, manifest.checksumFile);
  if (!(await pathExists(checksumPath))) {
    throw new CxError(
      `Bundle is missing checksum file ${manifest.checksumFile}.`,
      2,
    );
  }

  parseChecksumFile(await fs.readFile(checksumPath, "utf8"));
  return { manifestName };
}
