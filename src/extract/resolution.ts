import fs from "node:fs/promises";
import path from "node:path";

import type {
  CxManifest,
  CxSection,
  ManifestFileRow,
} from "../manifest/types.js";
import { CxError } from "../shared/errors.js";
import { sha256Text } from "../shared/hashing.js";
import {
  parseJsonSection,
  parseMarkdownSection,
  parsePlainSection,
  parseXmlSection,
} from "./parsers.js";

export type ExtractabilityReason =
  | "asset_copy"
  | "manifest_hash_match"
  | "manifest_hash_mismatch"
  | "missing_from_section_output"
  | "section_parse_failed";

export type ExtractabilityStatus = "exact" | "blocked" | "copied";

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
        : `${files.length} selected files could not be reconstructed exactly from the bundle output.`;
    super(detail, 8);
    this.files = files;
  }
}

function parseSectionSource(section: CxSection, source: string) {
  if (section.style === "xml") {
    return parseXmlSection(source);
  }
  if (section.style === "json") {
    return parseJsonSection(source);
  }
  if (section.style === "markdown") {
    return parseMarkdownSection(source);
  }
  if (section.style === "plain") {
    return parsePlainSection(source);
  }
  throw new CxError(
    `Extract does not support section style ${section.style} yet.`,
    8,
  );
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
      const parsed = parseSectionSource(section, source);
      const parsedMap = new Map(parsed.map((file) => [file.path, file.content]));

      for (const row of sectionRows) {
        const content = parsedMap.get(row.path);
        if (content === undefined) {
          records.push({
            path: row.path,
            section: row.section,
            kind: row.kind,
            status: "blocked",
            reason: "missing_from_section_output",
            message: `Section output is missing file ${row.path}.`,
            expectedSha256: row.sha256,
          });
          continue;
        }

        const actualSha256 = sha256Text(content);
        if (actualSha256 !== row.sha256) {
          records.push({
            path: row.path,
            section: row.section,
            kind: row.kind,
            status: "blocked",
            reason: "manifest_hash_mismatch",
            message: `Section output for ${row.path} does not match the manifest hash, so exact extraction is not supported for that file.`,
            expectedSha256: row.sha256,
            actualSha256,
          });
          continue;
        }

        records.push({
          path: row.path,
          section: row.section,
          kind: row.kind,
          status: "exact",
          reason: "manifest_hash_match",
          message: `Section output for ${row.path} matches the manifest hash.`,
          expectedSha256: row.sha256,
          actualSha256,
          content,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      for (const row of sectionRows) {
        records.push({
          path: row.path,
          section: row.section,
          kind: row.kind,
          status: "blocked",
          reason: "section_parse_failed",
          message: `Section ${section.name} could not be parsed for exact extraction: ${message}`,
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
