import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CxError } from "../shared/errors.js";
import type {
  AssetRecord,
  CxManifest,
  CxSection,
  ManifestFileRow,
  ManifestSettings,
  SectionOutputRecord,
} from "./types.js";

export const MANIFEST_SCHEMA_VERSION = 3 as const;

export const MANIFEST_SCHEMA_PATH: string = (() => {
  const _require = createRequire(import.meta.url);
  const packageRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
  );
  return path.join(packageRoot, "schemas", "manifest-v3.schema.json");
})();

interface SectionDto extends Omit<SectionOutputRecord, "style"> {
  style: string;
  files: unknown[];
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
  if (value === null) {
    return null;
  }
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

type FileRowWithoutSection = Omit<ManifestFileRow, "section">;

function parseManifestFileRow(
  raw: unknown,
  label: string,
): FileRowWithoutSection {
  const obj = requireObject(raw, label);

  return {
    path: requireString(obj.path, `${label}.path`),
    kind: requireString(obj.kind, `${label}.kind`) as ManifestFileRow["kind"],
    storedIn: requireString(
      obj.storedIn,
      `${label}.storedIn`,
    ) as ManifestFileRow["storedIn"],
    sha256: requireString(obj.sha256, `${label}.sha256`),
    sizeBytes: requireNumber(obj.sizeBytes, `${label}.sizeBytes`),
    tokenCount: requireNumber(obj.tokenCount, `${label}.tokenCount`),
    mtime: requireString(obj.mtime, `${label}.mtime`),
    mediaType: requireString(obj.mediaType, `${label}.mediaType`),
    outputStartLine: requireNumberOrNull(
      obj.outputStartLine,
      `${label}.outputStartLine`,
    ),
    outputEndLine: requireNumberOrNull(
      obj.outputEndLine,
      `${label}.outputEndLine`,
    ),
  };
}

function parseSectionDto(
  raw: unknown,
  index: number,
): { section: SectionDto; rows: FileRowWithoutSection[] } {
  const obj = requireObject(raw, `section[${index}]`);
  const label = `section[${index}]`;
  const files = requireArray(obj.files, `${label}.files`);
  const rows = files.map((file, fileIndex) =>
    parseManifestFileRow(file, `${label}.files[${fileIndex}]`),
  );

  const section: SectionDto = {
    name: requireString(obj.name, `${label}.name`),
    style: requireString(obj.style, `${label}.style`),
    outputFile: requireString(obj.outputFile, `${label}.outputFile`),
    outputSha256: requireString(obj.outputSha256, `${label}.outputSha256`),
    fileCount: requireNumber(obj.fileCount, `${label}.fileCount`),
    tokenCount: requireNumber(obj.tokenCount, `${label}.tokenCount`),
    files,
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
  const schemaVersion = requireNumber(obj.schemaVersion, "schemaVersion");

  if (schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    throw new CxError(
      `Unsupported manifest schema version ${schemaVersion}. ` +
        `This version of cx supports schema version ${MANIFEST_SCHEMA_VERSION}.`,
    );
  }

  const settingsRaw = requireObject(obj.settings, "settings");
  const listDisplayRaw = requireObject(
    settingsRaw.listDisplay,
    "settings.listDisplay",
  );
  const sectionsRaw = requireArray(obj.sections, "sections");
  const assetsRaw = requireArray(obj.assets ?? [], "assets");

  const sectionRows: FileRowWithoutSection[][] = [];
  const sections: SectionDto[] = sectionsRaw.map((section, index) => {
    const parsed = parseSectionDto(section, index);
    sectionRows.push(parsed.rows);
    return parsed.section;
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
    checksumAlgorithm: requireString(
      obj.checksumAlgorithm,
      "checksumAlgorithm",
    ),
    settings: {
      globalStyle: requireString(
        settingsRaw.globalStyle,
        "settings.globalStyle",
      ) as ManifestSettings["globalStyle"],
      tokenEncoding: requireString(
        settingsRaw.tokenEncoding,
        "settings.tokenEncoding",
      ),
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
        bytesWarm: requireNumber(
          listDisplayRaw.bytesWarm,
          "settings.listDisplay.bytesWarm",
        ),
        bytesHot: requireNumber(
          listDisplayRaw.bytesHot,
          "settings.listDisplay.bytesHot",
        ),
        tokensWarm: requireNumber(
          listDisplayRaw.tokensWarm,
          "settings.listDisplay.tokensWarm",
        ),
        tokensHot: requireNumber(
          listDisplayRaw.tokensHot,
          "settings.listDisplay.tokensHot",
        ),
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
    sections,
    assets: assetsRaw.map((asset, index) => parseAssetDto(asset, index)),
  };

  return { dto, sectionRows };
}

export function renderManifestJson(
  manifest: CxManifest,
  pretty = true,
): string {
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
      tokenCount: section.tokenCount,
      files: section.files.map((row) => ({
        path: row.path,
        kind: row.kind,
        storedIn: row.storedIn,
        sha256: row.sha256,
        sizeBytes: row.sizeBytes,
        tokenCount: row.tokenCount,
        mtime: row.mtime,
        mediaType: row.mediaType,
        outputStartLine: row.outputStartLine,
        outputEndLine: row.outputEndLine,
      })),
    })),
    assets: manifest.assets,
  };

  return `${JSON.stringify(out, null, indent)}\n`;
}

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

  const sections: CxSection[] = dto.sections.map((section, index) => ({
    name: section.name,
    style: section.style as CxSection["style"],
    outputFile: section.outputFile,
    outputSha256: section.outputSha256,
    fileCount: section.fileCount,
    tokenCount: section.tokenCount,
    files: (sectionRows[index] ?? []).map((row) => ({
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
    tokenCount: 0,
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
    files: [...textRows, ...assetRows].sort((left, right) =>
      left.path.localeCompare(right.path, "en"),
    ),
  };
}
