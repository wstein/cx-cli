import fs from "node:fs/promises";
import path from "node:path";

import { loadManifestFromBundle } from "../bundle/validate.js";
import type { ManifestFileRow } from "../manifest/types.js";
import { CxError } from "../shared/errors.js";
import { ensureDir } from "../shared/fs.js";
import { sha256File, sha256Text } from "../shared/hashing.js";
import {
  parseJsonSection,
  parseMarkdownSection,
  parsePlainSection,
  parseXmlSection,
} from "./parsers.js";

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

  const sectionNames = new Set(
    selectedRows
      .filter(isTextRow)
      .map((row) => row.section)
      .filter((value): value is string => value !== "-"),
  );
  const sectionContents = new Map<string, Map<string, string>>();

  for (const section of manifest.sections) {
    if (!sectionNames.has(section.name)) {
      continue;
    }
    const source = await fs.readFile(
      path.join(params.bundleDir, section.outputFile),
      "utf8",
    );
    const extractedFiles =
      section.style === "xml"
        ? parseXmlSection(source)
        : section.style === "json"
          ? parseJsonSection(source)
          : section.style === "markdown"
            ? parseMarkdownSection(source)
            : section.style === "plain"
              ? parsePlainSection(source)
              : (() => {
                  throw new CxError(
                    `Extract does not support section style ${section.style} yet.`,
                    8,
                  );
                })();
    sectionContents.set(
      section.name,
      new Map(extractedFiles.map((file) => [file.path, file.content])),
    );
  }

  const resolvedTextRows = selectedRows.filter(isTextRow).map((row) => {
    const contentMap = sectionContents.get(row.section);
    const content = contentMap?.get(row.path);
    if (content === undefined) {
      throw new CxError(`Section output is missing file ${row.path}.`, 8);
    }

    if (sha256Text(content) !== row.sha256) {
      throw new CxError(
        `Section output for ${row.path} does not match the manifest hash, so exact extraction is not supported for that file.`,
        8,
      );
    }

    return { row, content };
  });

  for (const { row, content } of resolvedTextRows) {
    const destinationPath = path.join(params.destinationDir, row.path);
    await assertWritable(destinationPath, params.overwrite);
    await ensureDir(path.dirname(destinationPath));
    await fs.writeFile(destinationPath, content, "utf8");

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

    if (params.verify && (await sha256File(destinationPath)) !== row.sha256) {
      throw new CxError(`Extracted asset hash mismatch for ${row.path}.`, 10);
    }
  }
}
