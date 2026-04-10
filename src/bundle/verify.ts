import fs from "node:fs/promises";
import path from "node:path";

import { parseChecksumFile } from "../manifest/checksums.js";
import { CxError } from "../shared/errors.js";
import { sha256File } from "../shared/hashing.js";
import {
  selectManifestRows,
  type VerifySelection,
} from "../shared/verifyFilters.js";
import { loadManifestFromBundle, validateBundle } from "./validate.js";

async function verifyBundleAgainstSourceTree(
  bundleDir: string,
  sourceDir: string,
  selection: VerifySelection,
): Promise<void> {
  const { manifest } = await loadManifestFromBundle(bundleDir);
  const selectedFiles = selectManifestRows(manifest.files, selection);

  for (const file of selectedFiles) {
    const sourcePath = path.join(sourceDir, file.path);
    try {
      const sourceHash = await sha256File(sourcePath);
      if (sourceHash !== file.sha256) {
        throw new CxError(
          `Source tree mismatch for ${file.path}: bundle and source hashes differ.`,
          10,
        );
      }
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        throw new CxError(`Source tree is missing ${file.path}.`, 10);
      }
      throw error;
    }
  }
}

export async function verifyBundle(
  bundleDir: string,
  againstDir?: string,
  selection: VerifySelection = { sections: undefined, files: undefined },
): Promise<void> {
  const { manifestName } = await validateBundle(bundleDir);
  const { manifest } = await loadManifestFromBundle(bundleDir);
  const selectedFiles = selectManifestRows(manifest.files, selection);
  const selectedSections = manifest.sections.filter((section) =>
    selectedFiles.some((file) => file.section === section.name),
  );
  const selectedAssets = manifest.assets.filter((asset) =>
    selectedFiles.some((file) => file.path === asset.sourcePath),
  );
  const checksums = parseChecksumFile(
    await fs.readFile(path.join(bundleDir, manifest.checksumFile), "utf8"),
  );
  const expectedFiles = new Set([
    manifestName,
    ...selectedSections.map((section) => section.outputFile),
    ...selectedAssets.map((asset) => asset.storedPath),
  ]);
  const listedFiles = new Set(
    checksums.map((checksum) => checksum.relativePath),
  );

  for (const checksum of checksums) {
    if (!expectedFiles.has(checksum.relativePath)) {
      if (selection.sections?.length || selection.files?.length) {
        continue;
      }
      throw new CxError(
        `Checksum file references an unexpected path: ${checksum.relativePath}.`,
        10,
      );
    }

    const actualHash = await sha256File(
      path.join(bundleDir, checksum.relativePath),
    );
    if (actualHash !== checksum.hash) {
      throw new CxError(`Checksum mismatch for ${checksum.relativePath}.`, 10);
    }
  }

  for (const expectedFile of expectedFiles) {
    if (!listedFiles.has(expectedFile)) {
      throw new CxError(
        `Checksum file is missing an entry for ${expectedFile}.`,
        10,
      );
    }
  }

  if (againstDir) {
    await verifyBundleAgainstSourceTree(bundleDir, againstDir, selection);
  }
}
