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

export type VerifyFailureType =
  | "checksum_omission"
  | "checksum_mismatch"
  | "unexpected_checksum_reference"
  | "source_tree_drift";

export class VerifyError extends CxError {
  readonly type: VerifyFailureType;
  readonly relativePath: string | undefined;

  constructor(
    type: VerifyFailureType,
    message: string,
    relativePath?: string,
    exitCode = 10,
  ) {
    super(message, exitCode);
    this.type = type;
    this.relativePath = relativePath;
  }
}

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
        throw new VerifyError(
          "source_tree_drift",
          `Source tree mismatch for ${file.path}: bundle and source hashes differ.`,
          file.path,
        );
      }
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        throw new VerifyError(
          "source_tree_drift",
          `Source tree is missing ${file.path}.`,
          file.path,
        );
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
      throw new VerifyError(
        "unexpected_checksum_reference",
        `Checksum file references an unexpected path: ${checksum.relativePath}.`,
        checksum.relativePath,
      );
    }

    const actualHash = await sha256File(
      path.join(bundleDir, checksum.relativePath),
    );
    if (actualHash !== checksum.hash) {
      throw new VerifyError(
        "checksum_mismatch",
        `Checksum mismatch for ${checksum.relativePath}.`,
        checksum.relativePath,
      );
    }
  }

  for (const expectedFile of expectedFiles) {
    if (!listedFiles.has(expectedFile)) {
      throw new VerifyError(
        "checksum_omission",
        `Checksum file is missing an entry for ${expectedFile}.`,
        expectedFile,
      );
    }
  }

  if (againstDir) {
    await verifyBundleAgainstSourceTree(bundleDir, againstDir, selection);
  }
}
