import path from "node:path";

import { loadManifestFromBundle } from "../../bundle/validate.js";
import { extractBundle } from "../../extract/extract.js";
import {
  type ExtractabilityRecord,
  ExtractResolutionError,
  resolveExtractability,
} from "../../extract/resolution.js";
import { getRepomixCapabilities } from "../../repomix/render.js";
import {
  CxError,
  formatErrorRemediation,
  getErrorRemediation,
} from "../../shared/errors.js";
import {
  selectManifestAssets,
  selectManifestSections,
  summarizeManifest,
} from "../../shared/manifestSummary.js";
import {
  type CommandIo,
  resolveCommandIo,
  writeJson,
  writeStderr,
} from "../../shared/output.js";
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

const DIFF_HINTS: Record<string, string> = {
  manifest_hash_mismatch: "hash mismatch",
  missing_from_section_output: "not found in section output",
  missing_output_span: "missing output span",
  section_parse_failed: "section parse error",
  asset_copy: "asset copied directly",
};

/** Format checksum prefix (first 8 chars) for display. */
function formatChecksumPrefix(checksum: string | undefined): string {
  return checksum ? checksum.slice(0, 8) : "—";
}

function writeExtractionErrorTable(
  files: ExtractabilityRecord[],
  io: Partial<CommandIo> = {},
): void {
  const header = `\nEXTRACTION ERRORS (${files.length} file${files.length === 1 ? "" : "s"} cannot be reconstructed deterministically)\n`;
  writeStderr(header, io);

  const pathW = Math.max(4, ...files.map((f) => f.path.length));
  const statusW = Math.max(6, ...files.map((f) => f.status.length));

  const pad = (s: string, w: number) => s.padEnd(w);
  const sep = `  ${"─".repeat(pathW)}  ${"─".repeat(statusW)}  ${"─".repeat(40)}\n`;

  writeStderr(
    `\n  ${pad("PATH", pathW)}  ${pad("STATUS", statusW)}  HINT\n`,
    io,
  );
  writeStderr(sep, io);

  for (const file of files) {
    let hint = DIFF_HINTS[file.reason] ?? file.message;
    if (
      file.reason === "manifest_hash_mismatch" &&
      file.expectedSha256 &&
      file.actualSha256
    ) {
      const expected = formatChecksumPrefix(file.expectedSha256);
      const actual = formatChecksumPrefix(file.actualSha256);
      hint = `expected ${expected}… got ${actual}…`;
    }
    writeStderr(
      `  ${pad(file.path, pathW)}  ${pad(file.status, statusW)}  ${hint}\n`,
      io,
    );
  }

  writeStderr("\n", io);
}

function writeRemediationBlock(
  error: unknown,
  io: Partial<CommandIo> = {},
): void {
  const lines = formatErrorRemediation(getErrorRemediation(error));
  if (lines.length === 0) {
    return;
  }

  writeStderr("REMEDIATION\n", io);
  for (const line of lines) {
    writeStderr(`${line}\n`, io);
  }
  writeStderr("\n", io);
}

export async function runExtractCommand(
  args: ExtractArgs,
  ioArg: Partial<CommandIo> = {},
): Promise<number> {
  const io = resolveCommandIo(ioArg);
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
      const resolved =
        error instanceof Error ? error : new Error(String(error));
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
      const extractabilityFiles =
        extractResolutionError?.files ?? fallbackFiles;
      const extractabilityType =
        extractabilityFiles.length > 0
          ? "extractability_mismatch"
          : "extract_failed";
      writeJson(
        {
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
        },
        io,
      );
      return error instanceof CxError ? error.exitCode : 1;
    }

    if (isExtractResolutionError(error)) {
      writeExtractionErrorTable(error.files, io);
      writeRemediationBlock(error, io);
      return error.exitCode;
    }
    throw error;
  }
  if (args.json ?? false) {
    writeJson(
      {
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
      },
      io,
    );
  }
  return 0;
}
