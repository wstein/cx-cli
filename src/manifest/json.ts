import { CxError } from "../shared/errors.js";
import type {
  AssetRecord,
  CxManifest,
  CxSection,
  ManifestFileRow,
  ManifestSettings,
  SectionOutputRecord,
} from "./types.js";

// ---------------------------------------------------------------------------
// Schema version
// ---------------------------------------------------------------------------

/** The schema version produced and accepted by this implementation. */
export const MANIFEST_SCHEMA_VERSION = 2 as const;

// ---------------------------------------------------------------------------
// File-row column layout
// ---------------------------------------------------------------------------

/** Ordered column names written to every section's `files.columns` array. */
export const FILE_ROW_COLUMNS = [
  "path",
  "kind",
  "storedIn",
  "sha256",
  "sizeBytes",
  "mtime",
  "mediaType",
  "outputStartLine",
  "outputEndLine",
] as const;

/** Column indices within a data row — avoids magic numbers throughout parsing. */
const COL = {
  path: 0,
  kind: 1,
  storedIn: 2,
  sha256: 3,
  sizeBytes: 4,
  mtime: 5,
  mediaType: 6,
  outputStartLine: 7,
  outputEndLine: 8,
} as const;

// ---------------------------------------------------------------------------
// DTO types — mirror the on-disk JSON structure.
// ---------------------------------------------------------------------------

/** A section's file table as stored on disk. */
interface FileTableDto {
  columns: string[];
  rows: unknown[][];
}

interface SectionDto extends Omit<SectionOutputRecord, "style"> {
  style: string;
  files: FileTableDto;
}

interface ManifestDto {
  schemaVersion: number;
  bundleVersion: number;
  projectName: string;
  sourceRoot: string;
  bundleDir: string;
  checksumFile: string;
  createdAt: string;
  cxVersion: string;
  repomixVersion: string;
  checksumAlgorithm: string;
  settings: ManifestSettings;
  sections: SectionDto[];
  assets: AssetRecord[];
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new CxError(`Missing or invalid ${label} in manifest.`);
  }
  return value;
}

function requireNumber(value: unknown, label: string): number {
  if (typeof value !== "number") {
    throw new CxError(`Missing or invalid ${label} in manifest.`);
  }
  return value;
}

function requireBool(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new CxError(`Missing or invalid ${label} in manifest.`);
  }
  return value;
}

function requireNumberOrNull(value: unknown, label: string): number | null {
  if (value === null) return null;
  return requireNumber(value, label);
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new CxError(`Missing or invalid ${label} in manifest.`);
  }
  return value as Record<string, unknown>;
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new CxError(`Missing or invalid ${label} in manifest.`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// DTO validation — file table
// ---------------------------------------------------------------------------

type FileRowWithoutSection = Omit<ManifestFileRow, "section">;

function parseFileTable(
  raw: unknown,
  sectionLabel: string,
): FileRowWithoutSection[] {
  const tableObj = requireObject(raw, `${sectionLabel}.files`);

  // Validate columns array.
  const columns = requireArray(tableObj.columns, `${sectionLabel}.files.columns`);
  if (columns.length !== FILE_ROW_COLUMNS.length) {
    throw new CxError(
      `${sectionLabel}.files.columns: expected ${FILE_ROW_COLUMNS.length} columns, got ${columns.length}.`,
    );
  }
  for (let i = 0; i < FILE_ROW_COLUMNS.length; i++) {
    if (columns[i] !== FILE_ROW_COLUMNS[i]) {
      throw new CxError(
        `${sectionLabel}.files.columns[${i}]: expected "${FILE_ROW_COLUMNS[i]}", got "${String(columns[i])}"`,
      );
    }
  }

  // Parse data rows.
  const rows = requireArray(tableObj.rows, `${sectionLabel}.files.rows`);
  return rows.map((rawRow, rowIndex) => {
    const rowLabel = `${sectionLabel}.files.rows[${rowIndex}]`;
    const row = requireArray(rawRow, rowLabel);
    if (row.length !== FILE_ROW_COLUMNS.length) {
      throw new CxError(
        `${rowLabel}: expected ${FILE_ROW_COLUMNS.length} columns, got ${row.length}.`,
      );
    }
    return {
      path: requireString(row[COL.path], `${rowLabel}[${COL.path}]`),
      kind: requireString(row[COL.kind], `${rowLabel}[${COL.kind}]`) as ManifestFileRow["kind"],
      storedIn: requireString(row[COL.storedIn], `${rowLabel}[${COL.storedIn}]`) as ManifestFileRow["storedIn"],
      sha256: requireString(row[COL.sha256], `${rowLabel}[${COL.sha256}]`),
      sizeBytes: requireNumber(row[COL.sizeBytes], `${rowLabel}[${COL.sizeBytes}]`),
      mtime: requireString(row[COL.mtime], `${rowLabel}[${COL.mtime}]`),
      mediaType: requireString(row[COL.mediaType], `${rowLabel}[${COL.mediaType}]`),
      outputStartLine: requireNumberOrNull(row[COL.outputStartLine], `${rowLabel}[${COL.outputStartLine}]`),
      outputEndLine: requireNumberOrNull(row[COL.outputEndLine], `${rowLabel}[${COL.outputEndLine}]`),
    };
  });
}

// ---------------------------------------------------------------------------
// DTO validation — sections and assets
// ---------------------------------------------------------------------------

function parseSectionDto(
  raw: unknown,
  index: number,
): { section: SectionDto; rows: FileRowWithoutSection[] } {
  const obj = requireObject(raw, `section[${index}]`);
  const label = `section[${index}]`;
  const rows = parseFileTable(obj.files, label);

  const section: SectionDto = {
    name: requireString(obj.name, `${label}.name`),
    style: requireString(obj.style, `${label}.style`),
    outputFile: requireString(obj.outputFile, `${label}.outputFile`),
    outputSha256: requireString(obj.outputSha256, `${label}.outputSha256`),
    fileCount: requireNumber(obj.fileCount, `${label}.fileCount`),
    files: { columns: [...FILE_ROW_COLUMNS], rows: [] }, // placeholder
  };

  return { section, rows };
}

function parseAssetDto(raw: unknown, index: number): AssetRecord {
  const obj = requireObject(raw, `asset[${index}]`);
  return {
    sourcePath: requireString(obj.sourcePath, `asset[${index}].sourcePath`),
    storedPath: requireString(obj.storedPath, `asset[${index}].storedPath`),
    sha256: requireString(obj.sha256, `asset[${index}].sha256`),
    sizeBytes: requireNumber(obj.sizeBytes, `asset[${index}].sizeBytes`),
    mtime: requireString(obj.mtime, `asset[${index}].mtime`),
    mediaType: requireString(obj.mediaType, `asset[${index}].mediaType`),
  };
}

function parseManifestDto(raw: unknown): {
  dto: ManifestDto;
  sectionRows: FileRowWithoutSection[][];
} {
  const obj = requireObject(raw, "manifest root");

  // Guard against unknown schema versions before touching any other field.
  const schemaVersion = requireNumber(obj.schemaVersion, "schemaVersion");
  if (schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    throw new CxError(
      `Unsupported manifest schema version ${schemaVersion}. ` +
        `This version of cx supports schema version ${MANIFEST_SCHEMA_VERSION}.`,
    );
  }

  const settingsRaw = requireObject(obj.settings, "settings");
  const listDisplayRaw = requireObject(settingsRaw.listDisplay, "settings.listDisplay");
  const sectionsRaw = requireArray(obj.sections, "sections");
  const assetsRaw = requireArray(obj.assets ?? [], "assets");

  const sectionRows: FileRowWithoutSection[][] = [];
  const sections: SectionDto[] = sectionsRaw.map((s, i) => {
    const { section, rows } = parseSectionDto(s, i);
    sectionRows.push(rows);
    return section;
  });

  const dto: ManifestDto = {
    schemaVersion,
    bundleVersion: requireNumber(obj.bundleVersion, "bundleVersion"),
    projectName: requireString(obj.projectName, "projectName"),
    sourceRoot: requireString(obj.sourceRoot, "sourceRoot"),
    bundleDir: requireString(obj.bundleDir, "bundleDir"),
    checksumFile: requireString(obj.checksumFile, "checksumFile"),
    createdAt: requireString(obj.createdAt, "createdAt"),
    cxVersion: requireString(obj.cxVersion, "cxVersion"),
    repomixVersion: requireString(obj.repomixVersion, "repomixVersion"),
    checksumAlgorithm: requireString(obj.checksumAlgorithm, "checksumAlgorithm"),
    settings: {
      globalStyle: requireString(
        settingsRaw.globalStyle,
        "settings.globalStyle",
      ) as ManifestSettings["globalStyle"],
      tokenAlgorithm: requireString(
        settingsRaw.tokenAlgorithm,
        "settings.tokenAlgorithm",
      ) as ManifestSettings["tokenAlgorithm"],
      removeComments: requireBool(settingsRaw.removeComments, "settings.removeComments"),
      removeEmptyLines: requireBool(settingsRaw.removeEmptyLines, "settings.removeEmptyLines"),
      compress: requireBool(settingsRaw.compress, "settings.compress"),
      showLineNumbers: requireBool(settingsRaw.showLineNumbers, "settings.showLineNumbers"),
      includeEmptyDirectories: requireBool(
        settingsRaw.includeEmptyDirectories,
        "settings.includeEmptyDirectories",
      ),
      securityCheck: requireBool(settingsRaw.securityCheck, "settings.securityCheck"),
      listDisplay: {
        bytesWarm: requireNumber(listDisplayRaw.bytesWarm, "settings.listDisplay.bytesWarm"),
        bytesHot: requireNumber(listDisplayRaw.bytesHot, "settings.listDisplay.bytesHot"),
        tokensWarm: requireNumber(listDisplayRaw.tokensWarm, "settings.listDisplay.tokensWarm"),
        tokensHot: requireNumber(listDisplayRaw.tokensHot, "settings.listDisplay.tokensHot"),
        mtimeWarmMinutes: requireNumber(
          listDisplayRaw.mtimeWarmMinutes,
          "settings.listDisplay.mtimeWarmMinutes",
        ),
        mtimeHotHours: requireNumber(
          listDisplayRaw.mtimeHotHours,
          "settings.listDisplay.mtimeHotHours",
        ),
        timePalette: requireArray(
          listDisplayRaw.timePalette,
          "settings.listDisplay.timePalette",
        ).map((entry, i) =>
          requireNumber(entry, `settings.listDisplay.timePalette[${i}]`),
        ),
      },
    },
    sections,
    assets: assetsRaw.map((a, i) => parseAssetDto(a, i)),
  };

  return { dto, sectionRows };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Serialise a manifest to JSON.
 *
 * Each section's `files` field is an object with a `columns` array (the
 * ordered field names) and a `rows` array of positional value arrays.
 *
 * @param pretty - When `true` (the default), the output is indented with two
 *   spaces. Pass `false` for compact single-line JSON suitable for CI
 *   environments where file size matters more than readability.
 */
export function renderManifestJson(manifest: CxManifest, pretty = true): string {
  const indent = pretty ? 2 : undefined;
  const out = {
    schemaVersion: manifest.schemaVersion,
    bundleVersion: manifest.bundleVersion,
    projectName: manifest.projectName,
    sourceRoot: manifest.sourceRoot,
    bundleDir: manifest.bundleDir,
    checksumFile: manifest.checksumFile,
    createdAt: manifest.createdAt,
    cxVersion: manifest.cxVersion,
    repomixVersion: manifest.repomixVersion,
    checksumAlgorithm: manifest.checksumAlgorithm,
    settings: manifest.settings,
    sections: manifest.sections.map((section) => ({
      name: section.name,
      style: section.style,
      outputFile: section.outputFile,
      outputSha256: section.outputSha256,
      fileCount: section.fileCount,
      files: {
        columns: [...FILE_ROW_COLUMNS],
        rows: section.files.map((row) => [
          row.path,
          row.kind,
          row.storedIn,
          row.sha256,
          row.sizeBytes,
          row.mtime,
          row.mediaType,
          row.outputStartLine,
          row.outputEndLine,
        ]),
      },
    })),
    assets: manifest.assets,
  };
  return `${JSON.stringify(out, null, indent)}\n`;
}

/**
 * Parse a manifest from JSON produced by {@link renderManifestJson}.
 *
 * Reconstructs the runtime `files` flat list from the per-section tables.
 * Throws {@link CxError} for unsupported schema versions or malformed data.
 */
export function parseManifestJson(source: string): CxManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch (error) {
    throw new CxError(
      `Failed to parse manifest: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const { dto, sectionRows } = parseManifestDto(raw);

  const sections: CxSection[] = dto.sections.map((section, i) => ({
    name: section.name,
    style: section.style as CxSection["style"],
    outputFile: section.outputFile,
    outputSha256: section.outputSha256,
    fileCount: section.fileCount,
    files: (sectionRows[i] ?? []).map((row) => ({
      ...row,
      section: section.name,
    })),
  }));

  const textRows: ManifestFileRow[] = sections.flatMap((section) =>
    section.files.map((row) => ({ ...row, section: section.name })),
  );

  const assetRows: ManifestFileRow[] = dto.assets.map((asset) => ({
    path: asset.sourcePath,
    kind: "asset",
    section: "-",
    storedIn: "copied",
    sha256: asset.sha256,
    sizeBytes: asset.sizeBytes,
    mtime: asset.mtime,
    mediaType: asset.mediaType,
    outputStartLine: null,
    outputEndLine: null,
  }));

  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    bundleVersion: 1,
    projectName: dto.projectName,
    sourceRoot: dto.sourceRoot,
    bundleDir: dto.bundleDir,
    checksumFile: dto.checksumFile,
    createdAt: dto.createdAt,
    cxVersion: dto.cxVersion,
    repomixVersion: dto.repomixVersion,
    checksumAlgorithm: "sha256",
    settings: dto.settings,
    sections,
    assets: dto.assets,
    files: [...textRows, ...assetRows].sort((a, b) =>
      a.path.localeCompare(b.path, "en"),
    ),
  };
}
