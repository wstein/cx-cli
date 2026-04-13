import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { CxConfig } from "../config/types.js";
import { parseChecksumFile } from "../manifest/checksums.js";
import { lockFileName } from "../manifest/lock.js";
import { renderSectionWithRepomix } from "../repomix/render.js";
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
  config: CxConfig,
): Promise<void> {
  const { manifest } = await loadManifestFromBundle(bundleDir);
  const selectedFiles = selectManifestRows(manifest.files, selection);

  const selectedTextFiles = selectedFiles.filter(
    (file) => file.kind === "text",
  );
  const selectedSections = manifest.sections.filter((section) =>
    selectedTextFiles.some((file) => file.section === section.name),
  );

  for (const section of selectedSections) {
    const sectionRows = selectedTextFiles.filter(
      (file) => file.section === section.name,
    );
    const explicitFiles = sectionRows.map((file) =>
      path.join(sourceDir, file.path),
    );
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-verify-"));
    try {
      const renderResult = await renderSectionWithRepomix({
        config: {
          ...config,
          projectName: manifest.projectName,
          sourceRoot: sourceDir,
          repomix: {
            ...config.repomix,
            showLineNumbers: manifest.settings.showLineNumbers,
            includeEmptyDirectories: manifest.settings.includeEmptyDirectories,
            securityCheck: manifest.settings.securityCheck,
          },
          tokens: {
            ...config.tokens,
            encoding: manifest.settings.tokenEncoding,
          },
        },
        style: section.style,
        sourceRoot: sourceDir,
        outputPath: path.join(tmpDir, "output"),
        sectionName: section.name,
        explicitFiles,
        requireStructured: true,
      });

      for (const file of sectionRows) {
        const sourceHash = renderResult.fileContentHashes.get(file.path);
        if (sourceHash === undefined) {
          throw new VerifyError(
            "source_tree_drift",
            `Source tree render for ${file.path} omitted normalized packed content.`,
            file.path,
          );
        }
        if (sourceHash !== file.sha256) {
          throw new VerifyError(
            "source_tree_drift",
            `Source tree mismatch for ${file.path}: normalized packed content differs between bundle and source tree.`,
            file.path,
          );
        }
      }
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }
}

export async function verifyBundle(
  bundleDir: string,
  againstDir?: string,
  selection: VerifySelection = { sections: undefined, files: undefined },
  config?: CxConfig,
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
  const listedFiles = new Set(
    checksums.map((checksum) => checksum.relativePath),
  );
  const lock = lockFileName(manifest.projectName);
  const expectedFiles = new Set([
    manifestName,
    ...(manifest.bundleIndexFile ? [manifest.bundleIndexFile] : []),
    ...selectedSections.map((section) => section.outputFile),
    ...selectedAssets.map((asset) => asset.storedPath),
    // Include the lock file only when present — older bundles do not have one.
    ...(listedFiles.has(lock) ? [lock] : []),
  ]);

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
    if (!config) {
      throw new CxError(
        "A loaded cx config is required to verify normalized content against a source tree.",
        2,
      );
    }
    await verifyBundleAgainstSourceTree(
      bundleDir,
      againstDir,
      selection,
      config,
    );
  }
}
