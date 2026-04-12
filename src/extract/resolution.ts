import fs from "node:fs/promises";
import path from "node:path";

import type {
  CxManifest,
  ManifestFileRow,
} from "../manifest/types.js";
import { CxError } from "../shared/errors.js";
import { sha256Text } from "../shared/hashing.js";
import { readSpanContent, splitOutputLines } from "./lineSpans.js";

export type ExtractabilityReason =
  | "asset_copy"
  | "manifest_hash_match"
  | "manifest_hash_mismatch"
  | "missing_from_section_output"
  | "missing_output_span"
  | "section_parse_failed";

export type ExtractabilityStatus = "intact" | "copied" | "degraded" | "blocked";

export interface ExtractabilityRecord {
  path: string;
  section: string | "-";
  kind: ManifestFileRow["kind"];
  status: ExtractabilityStatus;
  reason: ExtractabilityReason;
  message: string;
  expectedSha256?: string;
  actualSha256?: string;
  content?: string;
}

export interface ExtractResolution {
  records: ExtractabilityRecord[];
  recordsByPath: Map<string, ExtractabilityRecord>;
}

export class ExtractResolutionError extends CxError {
  readonly type = "extractability_mismatch";
  readonly files: ExtractabilityRecord[];

  constructor(files: ExtractabilityRecord[]) {
    const first = files[0];
    const detail =
      files.length === 1 && first
        ? first.message
        : `${files.length} selected files could not be reconstructed deterministically from the bundle output.`;
    super(detail, 8);
    this.files = files;
  }
}

function parseJsonSectionSource(source: string) {
  const parsed = JSON.parse(source) as { files?: Record<string, unknown> };
  if (!parsed.files || typeof parsed.files !== "object") {
    throw new CxError("Invalid JSON section output.", 8);
  }

  return new Map(
    Object.entries(parsed.files).map(([filePath, content]) => {
      if (typeof content !== "string") {
        throw new CxError(
          `Invalid content for ${filePath} in JSON section output.`,
          8,
        );
      }
      return [filePath, content] as const;
    }),
  );
}

function parseTextSectionSource(source: string): string[] {
  return splitOutputLines(source);
}

function resolveTextRow(params: {
  row: ManifestFileRow;
  lines: string[];
}): ExtractabilityRecord {
  const { row, lines } = params;
  const content = readSpanContent(lines, row.outputStartLine, row.outputEndLine);
  if (content === undefined) {
    return {
      path: row.path,
      section: row.section,
      kind: row.kind,
      status: "blocked",
      reason: "missing_output_span",
      message: `Section output does not expose an output span for ${row.path}.`,
      expectedSha256: row.sha256,
    };
  }

  const actualSha256 = sha256Text(content);
  if (actualSha256 !== row.sha256) {
    return {
      path: row.path,
      section: row.section,
      kind: row.kind,
      status: "degraded",
      reason: "manifest_hash_mismatch",
      message: `Section output for ${row.path} does not match the normalized packed-content hash in the manifest.`,
      expectedSha256: row.sha256,
      actualSha256,
      content,
    };
  }

  return {
    path: row.path,
    section: row.section,
    kind: row.kind,
    status: "intact",
    reason: "manifest_hash_match",
    message: `Section output for ${row.path} matches the normalized packed-content hash in the manifest.`,
    expectedSha256: row.sha256,
    actualSha256,
    content,
  };
}

function resolveJsonRow(params: {
  row: ManifestFileRow;
  files: Map<string, string>;
}): ExtractabilityRecord {
  const { row, files } = params;
  const content = files.get(row.path);
  if (content === undefined) {
    return {
      path: row.path,
      section: row.section,
      kind: row.kind,
      status: "blocked",
      reason: "missing_from_section_output",
      message: `Section output is missing file ${row.path}.`,
      expectedSha256: row.sha256,
    };
  }

  const actualSha256 = sha256Text(content);
  if (actualSha256 !== row.sha256) {
    return {
      path: row.path,
      section: row.section,
      kind: row.kind,
      status: "degraded",
      reason: "manifest_hash_mismatch",
      message: `Section output for ${row.path} does not match the normalized packed-content hash in the manifest.`,
      expectedSha256: row.sha256,
      actualSha256,
      content,
    };
  }

  return {
    path: row.path,
    section: row.section,
    kind: row.kind,
    status: "intact",
    reason: "manifest_hash_match",
    message: `Section output for ${row.path} matches the normalized packed-content hash in the manifest.`,
    expectedSha256: row.sha256,
    actualSha256,
    content,
  };
}

export async function resolveExtractability(params: {
  bundleDir: string;
  manifest: CxManifest;
  rows: ManifestFileRow[];
}): Promise<ExtractResolution> {
  const records: ExtractabilityRecord[] = [];
  const textRows = params.rows.filter((row) => row.kind === "text");
  const textRowsBySection = new Map<string, ManifestFileRow[]>();

  for (const row of textRows) {
    const rows = textRowsBySection.get(row.section) ?? [];
    rows.push(row);
    textRowsBySection.set(row.section, rows);
  }

  for (const section of params.manifest.sections) {
    const sectionRows = textRowsBySection.get(section.name);
    if (!sectionRows || sectionRows.length === 0) {
      continue;
    }

    try {
      const source = await fs.readFile(
        path.join(params.bundleDir, section.outputFile),
        "utf8",
      );
      if (section.style === "json") {
        const parsedMap = parseJsonSectionSource(source);
        for (const row of sectionRows) {
          records.push(resolveJsonRow({ row, files: parsedMap }));
        }
      } else {
        const lines = parseTextSectionSource(source);
        for (const row of sectionRows) {
          records.push(resolveTextRow({ row, lines }));
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      for (const row of sectionRows) {
        records.push({
          path: row.path,
          section: row.section,
          kind: row.kind,
          status: "blocked",
          reason: "section_parse_failed",
          message: `Section ${section.name} could not be parsed for deterministic extraction: ${message}`,
          expectedSha256: row.sha256,
        });
      }
    }
  }

  for (const row of params.rows.filter((entry) => entry.kind === "asset")) {
    records.push({
      path: row.path,
      section: row.section,
      kind: row.kind,
      status: "copied",
      reason: "asset_copy",
      message: `Asset ${row.path} is copied directly from stored bundle content.`,
      expectedSha256: row.sha256,
    });
  }

  return {
    records,
    recordsByPath: new Map(records.map((record) => [record.path, record])),
  };
}
