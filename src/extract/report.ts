import { loadManifestFromBundle } from "../bundle/validate.js";
import type { ExtractArgs } from "../cli/commands/extract.js";
import { ExtractCommandJsonSchema } from "../cli/jsonContracts.js";
import { CxError, getErrorRemediation } from "../shared/errors.js";
import {
  selectManifestAssets,
  selectManifestSections,
  summarizeManifest,
} from "../shared/manifestSummary.js";
import { selectManifestRows } from "../shared/verifyFilters.js";
import { extractBundle } from "./extract.js";
import {
  type ExtractabilityRecord,
  ExtractResolutionError,
  resolveExtractability,
} from "./resolution.js";

export function isExtractResolutionError(
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

export interface ExtractJsonReportResult {
  exitCode: number;
  payload: ReturnType<typeof ExtractCommandJsonSchema.parse>;
}

export async function collectExtractJsonReport(
  args: ExtractArgs,
): Promise<ExtractJsonReportResult> {
  const { manifest, manifestName } = await loadManifestFromBundle(
    args.bundleDir,
  );
  const rows = selectManifestRows(manifest.files, {
    sections: args.sections,
    files: args.files,
  }).filter((row) => !args.assetsOnly || row.kind === "asset");

  try {
    await extractBundle({
      bundleDir: args.bundleDir,
      destinationDir: args.destinationDir,
      sections: args.sections,
      files: args.files,
      assetsOnly: args.assetsOnly,
      allowDegraded: args.allowDegraded ?? false,
      overwrite: args.overwrite,
      verify: args.verify,
    });
  } catch (error) {
    const resolved = error instanceof Error ? error : new Error(String(error));
    const extractResolutionError = isExtractResolutionError(error)
      ? error
      : undefined;
    const fallbackResolution =
      extractResolutionError === undefined
        ? await resolveExtractability({
            bundleDir: args.bundleDir,
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

    return {
      exitCode: error instanceof CxError ? error.exitCode : 1,
      payload: ExtractCommandJsonSchema.parse({
        bundleDir: args.bundleDir,
        destinationDir: args.destinationDir,
        selection: {
          sections: args.sections ?? [],
          files: args.files ?? [],
        },
        assetsOnly: args.assetsOnly,
        allowDegraded: args.allowDegraded ?? false,
        summary: summarizeManifest(manifestName, manifest, rows),
        verify: args.verify,
        extractedSections: [],
        extractedAssets: [],
        extractedFiles: [],
        valid: false,
        error: {
          type: extractabilityType,
          message: resolved.message,
          remediation: getErrorRemediation(error) ?? null,
          files: extractabilityFiles.map((file: ExtractabilityRecord) => ({
            path: file.path,
            section: file.section,
            status: file.status,
            reason: file.reason,
            expectedSha256: file.expectedSha256,
            actualSha256: file.actualSha256,
            message: file.message,
          })),
        },
      }),
    };
  }

  return {
    exitCode: 0,
    payload: ExtractCommandJsonSchema.parse({
      bundleDir: args.bundleDir,
      destinationDir: args.destinationDir,
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
    }),
  };
}
