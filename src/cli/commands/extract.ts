import path from "node:path";

import { loadManifestFromBundle } from "../../bundle/validate.js";
import { extractBundle } from "../../extract/extract.js";
import {
  ExtractResolutionError,
  resolveExtractability,
  type ExtractabilityRecord,
} from "../../extract/resolution.js";
import { getRepomixCapabilities } from "../../repomix/render.js";
import { CxError } from "../../shared/errors.js";
import {
  selectManifestAssets,
  selectManifestSections,
  summarizeManifest,
} from "../../shared/manifestSummary.js";
import { writeJson } from "../../shared/output.js";
import { selectManifestRows } from "../../shared/verifyFilters.js";

export interface ExtractArgs {
  bundleDir: string;
  destinationDir: string;
  sections: string[] | undefined;
  files: string[] | undefined;
  assetsOnly: boolean;
  allowDegraded?: boolean | undefined;
  overwrite: boolean;
  verify: boolean;
  json?: boolean | undefined;
}

function isExtractResolutionError(
  error: unknown,
): error is ExtractResolutionError {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as {
    type?: unknown;
    files?: unknown;
    exitCode?: unknown;
  };

  return (
    error instanceof ExtractResolutionError ||
    (candidate.type === "extractability_mismatch" &&
      Array.isArray(candidate.files)) ||
    (candidate.exitCode === 8 && Array.isArray(candidate.files))
  );
}

export async function runExtractCommand(args: ExtractArgs): Promise<number> {
  const bundleDir = path.resolve(args.bundleDir);
  const destinationDir = path.resolve(args.destinationDir);
  const { manifest, manifestName } = await loadManifestFromBundle(bundleDir);
  const rows = selectManifestRows(manifest.files, {
    sections: args.sections,
    files: args.files,
  }).filter((row) => !args.assetsOnly || row.kind === "asset");

  try {
    await extractBundle({
      bundleDir,
      destinationDir,
      sections: args.sections,
      files: args.files,
      assetsOnly: args.assetsOnly,
      allowDegraded: args.allowDegraded ?? false,
      overwrite: args.overwrite,
      verify: args.verify,
    });
  } catch (error) {
    if (args.json ?? false) {
      const resolved = error instanceof Error ? error : new Error(String(error));
      const extractResolutionError = isExtractResolutionError(error)
        ? error
        : undefined;
      const fallbackResolution =
        extractResolutionError === undefined
          ? await resolveExtractability({
              bundleDir,
              manifest,
              rows,
            })
          : undefined;
      const fallbackFiles: ExtractabilityRecord[] =
        fallbackResolution?.records.filter(
          (record: ExtractabilityRecord) =>
            record.kind === "text" && record.status !== "intact",
        ) ?? [];
      const extractabilityFiles = extractResolutionError?.files ?? fallbackFiles;
      const extractabilityType =
        extractabilityFiles.length > 0
          ? "extractability_mismatch"
          : "extract_failed";
      writeJson({
        bundleDir,
        destinationDir,
        selection: {
          sections: args.sections ?? [],
          files: args.files ?? [],
        },
        assetsOnly: args.assetsOnly,
        allowDegraded: args.allowDegraded ?? false,
        summary: summarizeManifest(manifestName, manifest, rows),
        verify: args.verify,
        repomix: await getRepomixCapabilities(),
        extractedSections: [],
        extractedAssets: [],
        extractedFiles: [],
        valid: false,
        error: {
          type: extractabilityType,
          message: resolved.message,
          files: extractabilityFiles.map((file: ExtractabilityRecord) => ({
            path: file.path,
            section: file.section,
            reason: file.reason,
            expectedSha256: file.expectedSha256,
            actualSha256: file.actualSha256,
            message: file.message,
          })),
        },
      });
      return error instanceof CxError ? error.exitCode : 1;
    }
    throw error;
  }
  if (args.json ?? false) {
    writeJson({
      bundleDir,
      destinationDir,
      selection: {
        sections: args.sections ?? [],
        files: args.files ?? [],
      },
      assetsOnly: args.assetsOnly,
      allowDegraded: args.allowDegraded ?? false,
      extractedSections: selectManifestSections(manifest, rows).map(
        (section) => section.name,
      ),
      extractedAssets: selectManifestAssets(manifest, rows).map(
        (asset) => asset.sourcePath,
      ),
      extractedFiles: rows.map((row) => row.path),
      summary: summarizeManifest(manifestName, manifest, rows),
      verify: args.verify,
      valid: true,
    });
  }
  return 0;
}
