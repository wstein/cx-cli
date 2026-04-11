import fs from "node:fs/promises";
import path from "node:path";

import { loadManifestFromBundle } from "../bundle/validate.js";
import type { ManifestFileRow } from "../manifest/types.js";
import { CxError } from "../shared/errors.js";
import { ensureDir } from "../shared/fs.js";
import { sha256File } from "../shared/hashing.js";
import {
  ExtractResolutionError,
  resolveExtractability,
} from "./resolution.js";

async function assertWritable(
  destinationPath: string,
  overwrite: boolean,
): Promise<void> {
  if (overwrite) {
    return;
  }

  try {
    await fs.access(destinationPath);
    throw new CxError(
      `Destination already contains ${destinationPath}. Use --overwrite to replace it.`,
      9,
    );
  } catch (error) {
    if (error instanceof CxError) {
      throw error;
    }
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }
  }
}

async function restoreMtime(destinationPath: string, isoTime: string): Promise<void> {
  const value = new Date(isoTime);
  if (Number.isNaN(value.getTime())) {
    throw new CxError(`Invalid manifest mtime for ${destinationPath}.`, 2);
  }
  await fs.utimes(destinationPath, value, value);
}

function isTextRow(row: ManifestFileRow): boolean {
  return row.kind === "text";
}

function isAssetRow(row: ManifestFileRow): boolean {
  return row.kind === "asset";
}

export async function extractBundle(params: {
  bundleDir: string;
  destinationDir: string;
  sections: string[] | undefined;
  files: string[] | undefined;
  assetsOnly: boolean;
  overwrite: boolean;
  verify: boolean;
}): Promise<void> {
  const { manifest } = await loadManifestFromBundle(params.bundleDir);
  const selectedRows = manifest.files.filter((row) => {
    if (params.assetsOnly && row.kind !== "asset") {
      return false;
    }
    if (
      params.sections &&
      params.sections.length > 0 &&
      row.section !== "-" &&
      !params.sections.includes(row.section)
    ) {
      return false;
    }
    if (
      params.files &&
      params.files.length > 0 &&
      !params.files.includes(row.path)
    ) {
      return false;
    }
    return true;
  });

  const resolution = await resolveExtractability({
    bundleDir: params.bundleDir,
    manifest,
    rows: selectedRows,
  });
  const blockedFiles = resolution.records.filter(
    (record) => record.kind === "text" && record.status === "blocked",
  );
  if (blockedFiles.length > 0) {
    throw new ExtractResolutionError(blockedFiles);
  }

  for (const row of selectedRows.filter(isTextRow)) {
    const record = resolution.recordsByPath.get(row.path);
    const content = record?.content;
    if (content === undefined) {
      throw new CxError(`Section output is missing file ${row.path}.`, 8);
    }
    const destinationPath = path.join(params.destinationDir, row.path);
    await assertWritable(destinationPath, params.overwrite);
    await ensureDir(path.dirname(destinationPath));
    await fs.writeFile(destinationPath, content, "utf8");
    await restoreMtime(destinationPath, row.mtime);

    if (params.verify && (await sha256File(destinationPath)) !== row.sha256) {
      throw new CxError(`Extracted content hash mismatch for ${row.path}.`, 10);
    }
  }

  for (const row of selectedRows.filter(isAssetRow)) {
    const asset = manifest.assets.find(
      (entry) => entry.sourcePath === row.path,
    );
    if (!asset) {
      throw new CxError(`Manifest is missing asset record for ${row.path}.`, 2);
    }

    const destinationPath = path.join(params.destinationDir, row.path);
    await assertWritable(destinationPath, params.overwrite);
    await ensureDir(path.dirname(destinationPath));
    await fs.copyFile(
      path.join(params.bundleDir, asset.storedPath),
      destinationPath,
    );
    await restoreMtime(destinationPath, row.mtime);

    if (params.verify && (await sha256File(destinationPath)) !== row.sha256) {
      throw new CxError(`Extracted asset hash mismatch for ${row.path}.`, 10);
    }
  }
}
