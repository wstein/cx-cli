import fs from "node:fs/promises";
import path from "node:path";

import { parseChecksumFile } from "../manifest/checksums.js";
import { parseManifestJson } from "../manifest/json.js";
import { CxError } from "../shared/errors.js";
import { pathExists } from "../shared/fs.js";

type ReadUtf8 = (filePath: string, encoding: BufferEncoding) => Promise<string>;

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

export interface BundleValidationDeps {
  loadManifestFromBundle?: typeof loadManifestFromBundle;
  pathExists?: typeof pathExists;
  readFile?: ReadUtf8;
}

export async function validateBundle(
  bundleDir: string,
  deps: BundleValidationDeps = {},
): Promise<{ manifestName: string }> {
  const loadManifest = deps.loadManifestFromBundle ?? loadManifestFromBundle;
  const pathExistsFn = deps.pathExists ?? pathExists;
  const readFile =
    deps.readFile ?? ((filePath, encoding) => fs.readFile(filePath, encoding));

  const { manifest, manifestName } = await loadManifest(bundleDir);
  if (manifest.bundleVersion !== 1) {
    throw new CxError(
      `Unsupported bundle version ${manifest.bundleVersion}. ` +
        "This version of cx supports bundle version 1.",
      2,
    );
  }

  for (const section of manifest.sections) {
    if (!(await pathExistsFn(path.join(bundleDir, section.outputFile)))) {
      throw new CxError(
        `Bundle is missing section output ${section.outputFile}.`,
        2,
      );
    }
  }

  if (
    manifest.handoverFile &&
    !(await pathExistsFn(path.join(bundleDir, manifest.handoverFile)))
  ) {
    throw new CxError(
      `Bundle is missing shared handover ${manifest.handoverFile}.`,
      2,
    );
  }

  for (const asset of manifest.assets) {
    if (!(await pathExistsFn(path.join(bundleDir, asset.storedPath)))) {
      throw new CxError(`Bundle is missing asset ${asset.storedPath}.`, 2);
    }
  }

  const checksumPath = path.join(bundleDir, manifest.checksumFile);
  if (!(await pathExistsFn(checksumPath))) {
    throw new CxError(
      `Bundle is missing checksum file ${manifest.checksumFile}.`,
      2,
    );
  }

  parseChecksumFile(await readFile(checksumPath, "utf8"));
  return { manifestName };
}
