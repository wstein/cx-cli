import { decode, encode } from "@toon-format/toon";

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
// DTO types – mirror the JSON/TOON structure on disk.
// ---------------------------------------------------------------------------

interface FileRowDto {
  path: string;
  kind: string;
  storedIn: string;
  sha256: string;
  sizeBytes: number;
  mtime: string;
  mediaType: string;
  outputStartLine: number | null;
  outputEndLine: number | null;
}

interface SectionDto extends Omit<SectionOutputRecord, "style"> {
  style: string;
  files: FileRowDto[];
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
// DTO validation / coercion
// ---------------------------------------------------------------------------

function parseFileRowDto(raw: unknown, index: number): FileRowDto {
  const obj = requireObject(raw, `file row [${index}]`);
  return {
    path: requireString(obj.path, `file[${index}].path`),
    kind: requireString(obj.kind, `file[${index}].kind`),
    storedIn: requireString(obj.storedIn, `file[${index}].storedIn`),
    sha256: requireString(obj.sha256, `file[${index}].sha256`),
    sizeBytes: requireNumber(obj.sizeBytes, `file[${index}].sizeBytes`),
    mtime: requireString(obj.mtime, `file[${index}].mtime`),
    mediaType: requireString(obj.mediaType, `file[${index}].mediaType`),
    outputStartLine: requireNumberOrNull(
      obj.outputStartLine,
      `file[${index}].outputStartLine`,
    ),
    outputEndLine: requireNumberOrNull(
      obj.outputEndLine,
      `file[${index}].outputEndLine`,
    ),
  };
}

function parseSectionDto(raw: unknown, index: number): SectionDto {
  const obj = requireObject(raw, `section[${index}]`);
  const filesRaw = requireArray(obj.files, `section[${index}].files`);
  return {
    name: requireString(obj.name, `section[${index}].name`),
    style: requireString(obj.style, `section[${index}].style`),
    outputFile: requireString(obj.outputFile, `section[${index}].outputFile`),
    outputSha256: requireString(
      obj.outputSha256,
      `section[${index}].outputSha256`,
    ),
    fileCount: requireNumber(obj.fileCount, `section[${index}].fileCount`),
    files: filesRaw.map((f, fi) => parseFileRowDto(f, fi)),
  };
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

function parseManifestDto(raw: unknown): ManifestDto {
  const obj = requireObject(raw, "manifest root");
  const settingsRaw = requireObject(obj.settings, "settings");
  const listDisplayRaw = requireObject(
    settingsRaw.listDisplay,
    "settings.listDisplay",
  );
  const sectionsRaw = requireArray(obj.sections, "sections");
  const assetsRaw = requireArray(obj.assets ?? [], "assets");

  return {
    schemaVersion: requireNumber(obj.schemaVersion, "schemaVersion"),
    bundleVersion: requireNumber(obj.bundleVersion, "bundleVersion"),
    projectName: requireString(obj.projectName, "projectName"),
    sourceRoot: requireString(obj.sourceRoot, "sourceRoot"),
    bundleDir: requireString(obj.bundleDir, "bundleDir"),
    checksumFile: requireString(obj.checksumFile, "checksumFile"),
    createdAt: requireString(obj.createdAt, "createdAt"),
    cxVersion: requireString(obj.cxVersion, "cxVersion"),
    repomixVersion: requireString(obj.repomixVersion, "repomixVersion"),
    checksumAlgorithm: requireString(
      obj.checksumAlgorithm,
      "checksumAlgorithm",
    ),
    settings: {
      globalStyle: requireString(
        settingsRaw.globalStyle,
        "settings.globalStyle",
      ) as ManifestSettings["globalStyle"],
      tokenAlgorithm: requireString(
        settingsRaw.tokenAlgorithm,
        "settings.tokenAlgorithm",
      ) as ManifestSettings["tokenAlgorithm"],
      removeComments: requireBool(
        settingsRaw.removeComments,
        "settings.removeComments",
      ),
      removeEmptyLines: requireBool(
        settingsRaw.removeEmptyLines,
        "settings.removeEmptyLines",
      ),
      compress: requireBool(settingsRaw.compress, "settings.compress"),
      showLineNumbers: requireBool(
        settingsRaw.showLineNumbers,
        "settings.showLineNumbers",
      ),
      includeEmptyDirectories: requireBool(
        settingsRaw.includeEmptyDirectories,
        "settings.includeEmptyDirectories",
      ),
      securityCheck: requireBool(
        settingsRaw.securityCheck,
        "settings.securityCheck",
      ),
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
        ).map((entry, index) =>
          requireNumber(entry, `settings.listDisplay.timePalette[${index}]`),
        ),
      },
    },
    sections: sectionsRaw.map((s, i) => parseSectionDto(s, i)),
    assets: assetsRaw.map((a, i) => parseAssetDto(a, i)),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function renderManifestToon(manifest: CxManifest): string {
  const dto: ManifestDto = {
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
      files: section.files.map((row) => ({
        path: row.path,
        kind: row.kind,
        storedIn: row.storedIn,
        sha256: row.sha256,
        sizeBytes: row.sizeBytes,
        mtime: row.mtime,
        mediaType: row.mediaType,
        outputStartLine: row.outputStartLine,
        outputEndLine: row.outputEndLine,
      })),
    })),
    assets: manifest.assets,
  };
  return `${encode(dto)}\n`;
}

export function parseManifestToon(source: string): CxManifest {
  let raw: unknown;
  try {
    raw = decode(source);
  } catch (error) {
    throw new CxError(
      `Failed to parse manifest: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const dto = parseManifestDto(raw);

  // Reconstruct the flat files array expected by consumers.
  const textRows: ManifestFileRow[] = dto.sections.flatMap((section) =>
    section.files.map((row) => ({
      path: row.path,
      kind: row.kind as ManifestFileRow["kind"],
      section: section.name,
      storedIn: row.storedIn as ManifestFileRow["storedIn"],
      sha256: row.sha256,
      sizeBytes: row.sizeBytes,
      mtime: row.mtime,
      mediaType: row.mediaType,
      outputStartLine: row.outputStartLine,
      outputEndLine: row.outputEndLine,
    })),
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

  const sections: CxSection[] = dto.sections.map((section) => ({
    name: section.name,
    style: section.style as CxSection["style"],
    outputFile: section.outputFile,
    outputSha256: section.outputSha256,
    fileCount: section.fileCount,
    files: textRows.filter((row) => row.section === section.name),
  }));

  return {
    schemaVersion: 1,
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
