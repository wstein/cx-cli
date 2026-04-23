import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CxError } from "../shared/errors.js";
import type { DirtyState, VCSKind } from "../vcs/provider.js";
import type {
  AssetRecord,
  CxManifest,
  CxSection,
  DerivedReviewExportRecord,
  ManifestFileRow,
  ManifestSettings,
  ManifestTraceability,
  ManifestTrustModel,
  SectionOutputRecord,
} from "./types.js";
import { NORMALIZATION_POLICY } from "./types.js";

export const MANIFEST_SCHEMA_VERSION = 11 as const;

export const MANIFEST_SCHEMA_PATH: string = (() => {
  const _require = createRequire(import.meta.url);
  const packageRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
  );
  return path.join(packageRoot, "schemas", "manifest-v11.schema.json");
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
  handoverFile?: string;
  createdAt: string;
  cxVersion: string;
  checksumAlgorithm: string;
  settings: ManifestSettings;
  totalTokenCount: number;
  vcsProvider: string;
  dirtyState: string;
  modifiedFiles: string[];
  trustModel: ManifestTrustModel;
  traceability: ManifestTraceability;
  sections: SectionDto[];
  assets: AssetRecord[];
  derivedReviewExports?: DerivedReviewExportRecord[];
  notes: Array<{
    id: string;
    title: string;
    fileName: string;
    aliases: string[];
    tags: string[];
    summary: string;
    codeLinks: string[];
    cognitionScore: number;
    cognitionLabel: "high_signal" | "review" | "low_signal";
    trustLevel: "conditional";
    lastModified: string;
  }>;
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

function requireOptionalStringArray(
  value: unknown,
  label: string,
): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  return requireArray(value, label).map((entry, index) =>
    requireString(entry, `${label}[${index}]`),
  );
}

type FileRowWithoutSection = Omit<ManifestFileRow, "section">;

function parseManifestFileRow(
  raw: unknown,
  label: string,
): FileRowWithoutSection {
  const obj = requireObject(raw, label);
  const provenance =
    obj.provenance === undefined
      ? undefined
      : (requireOptionalStringArray(
          obj.provenance,
          `${label}.provenance`,
        ) as ManifestFileRow["provenance"]);

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
    ...(provenance !== undefined ? { provenance } : {}),
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
  const provenance =
    obj.provenance === undefined
      ? undefined
      : (requireOptionalStringArray(
          obj.provenance,
          `asset[${index}].provenance`,
        ) as AssetRecord["provenance"]);
  return {
    sourcePath: requireString(obj.sourcePath, `asset[${index}].sourcePath`),
    storedPath: requireString(obj.storedPath, `asset[${index}].storedPath`),
    sha256: requireString(obj.sha256, `asset[${index}].sha256`),
    sizeBytes: requireNumber(obj.sizeBytes, `asset[${index}].sizeBytes`),
    mtime: requireString(obj.mtime, `asset[${index}].mtime`),
    mediaType: requireString(obj.mediaType, `asset[${index}].mediaType`),
    ...(provenance !== undefined ? { provenance } : {}),
  };
}

function parseNoteDto(
  raw: unknown,
  index: number,
): {
  id: string;
  title: string;
  fileName: string;
  aliases: string[];
  tags: string[];
  summary: string;
  codeLinks: string[];
  cognitionScore: number;
  cognitionLabel: "high_signal" | "review" | "low_signal";
  trustLevel: "conditional";
  lastModified: string;
} {
  const obj = requireObject(raw, `note[${index}]`);
  const rawCodeLinks = obj.codeLinks;
  return {
    id: requireString(obj.id, `note[${index}].id`),
    title: requireString(obj.title, `note[${index}].title`),
    fileName: requireString(obj.fileName, `note[${index}].fileName`),
    aliases: requireArray(obj.aliases, `note[${index}].aliases`).map(
      (value, aliasIndex) =>
        requireString(value, `note[${index}].aliases[${aliasIndex}]`),
    ),
    tags: requireArray(obj.tags, `note[${index}].tags`).map((value, tagIndex) =>
      requireString(value, `note[${index}].tags[${tagIndex}]`),
    ),
    summary: requireString(obj.summary, `note[${index}].summary`),
    codeLinks:
      rawCodeLinks === undefined
        ? []
        : requireArray(rawCodeLinks, `note[${index}].codeLinks`).map(
            (value, linkIndex) =>
              requireString(value, `note[${index}].codeLinks[${linkIndex}]`),
          ),
    cognitionScore: requireNumber(
      obj.cognitionScore,
      `note[${index}].cognitionScore`,
    ),
    cognitionLabel: requireString(
      obj.cognitionLabel,
      `note[${index}].cognitionLabel`,
    ) as "high_signal" | "review" | "low_signal",
    trustLevel: requireString(
      obj.trustLevel,
      `note[${index}].trustLevel`,
    ) as "conditional",
    lastModified: requireString(
      obj.lastModified,
      `note[${index}].lastModified`,
    ),
  };
}

function parseDerivedReviewExportDto(
  raw: unknown,
  index: number,
): DerivedReviewExportRecord {
  const obj = requireObject(raw, `derivedReviewExport[${index}]`);
  const generator = requireObject(
    obj.generator,
    `derivedReviewExport[${index}].generator`,
  );

  return {
    assemblyName: requireString(
      obj.assemblyName,
      `derivedReviewExport[${index}].assemblyName`,
    ),
    title: requireString(obj.title, `derivedReviewExport[${index}].title`),
    moduleName:
      obj.moduleName === null || obj.moduleName === undefined
        ? null
        : requireString(
            obj.moduleName,
            `derivedReviewExport[${index}].moduleName`,
          ),
    storedPath: requireString(
      obj.storedPath,
      `derivedReviewExport[${index}].storedPath`,
    ),
    sha256: requireString(obj.sha256, `derivedReviewExport[${index}].sha256`),
    sizeBytes: requireNumber(
      obj.sizeBytes,
      `derivedReviewExport[${index}].sizeBytes`,
    ),
    pageCount: requireNumber(
      obj.pageCount,
      `derivedReviewExport[${index}].pageCount`,
    ),
    rootLevel: expectDerivedReviewExportRootLevel(
      obj.rootLevel,
      `derivedReviewExport[${index}].rootLevel`,
    ),
    sourcePaths: requireArray(
      obj.sourcePaths,
      `derivedReviewExport[${index}].sourcePaths`,
    ).map((value, sourceIndex) =>
      requireString(
        value,
        `derivedReviewExport[${index}].sourcePaths[${sourceIndex}]`,
      ),
    ),
    generator: {
      name: requireString(
        generator.name,
        `derivedReviewExport[${index}].generator.name`,
      ),
      version: requireString(
        generator.version,
        `derivedReviewExport[${index}].generator.version`,
      ),
      format: requireString(
        generator.format,
        `derivedReviewExport[${index}].generator.format`,
      ) as "multimarkdown",
      extension: requireString(
        generator.extension,
        `derivedReviewExport[${index}].generator.extension`,
      ) as ".mmd.txt",
    },
    trustClassification: requireString(
      obj.trustClassification,
      `derivedReviewExport[${index}].trustClassification`,
    ) as "derived_review_export",
  };
}

function expectDerivedReviewExportRootLevel(
  value: unknown,
  label: string,
): 0 | 1 {
  const rootLevel = requireNumber(value, label);
  if (rootLevel !== 0 && rootLevel !== 1) {
    throw new CxError(`Missing or invalid ${label} in manifest.`);
  }
  return rootLevel;
}

function parseTraceabilityDto(raw: unknown): ManifestTraceability {
  const obj = requireObject(raw, "traceability");
  const bundleRaw = requireObject(obj.bundle, "traceability.bundle");
  const notesRaw = requireObject(obj.notes, "traceability.notes");
  const agentRaw = requireObject(obj.agent, "traceability.agent");

  return {
    bundle: {
      command: requireString(
        bundleRaw.command,
        "traceability.bundle.command",
      ) as "cx bundle",
      track: requireString(bundleRaw.track, "traceability.bundle.track") as "A",
    },
    notes: {
      governanceCommand: requireString(
        notesRaw.governanceCommand,
        "traceability.notes.governanceCommand",
      ) as "cx notes check",
      trustLevel: requireString(
        notesRaw.trustLevel,
        "traceability.notes.trustLevel",
      ) as ManifestTraceability["notes"]["trustLevel"],
    },
    agent: {
      auditLogPath: requireString(
        agentRaw.auditLogPath,
        "traceability.agent.auditLogPath",
      ) as ".cx/audit.log",
      outputTrust: requireString(
        agentRaw.outputTrust,
        "traceability.agent.outputTrust",
      ) as "untrusted_until_verified",
      decisionSource: requireString(
        agentRaw.decisionSource,
        "traceability.agent.decisionSource",
      ) as "mcp_audit_log",
    },
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
  const trustModelRaw = requireObject(obj.trustModel, "trustModel");
  const traceability = parseTraceabilityDto(obj.traceability);
  const sectionsRaw = requireArray(obj.sections, "sections");
  const assetsRaw = requireArray(obj.assets ?? [], "assets");
  const derivedReviewExportsRaw =
    obj.derivedReviewExports === undefined
      ? []
      : requireArray(obj.derivedReviewExports, "derivedReviewExports");
  const notesRaw =
    obj.notes === undefined ? [] : requireArray(obj.notes, "notes");

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
      normalizationPolicy:
        settingsRaw.normalizationPolicy === undefined
          ? NORMALIZATION_POLICY
          : (requireString(
              settingsRaw.normalizationPolicy,
              "settings.normalizationPolicy",
            ) as typeof NORMALIZATION_POLICY),
      includeLinkedNotes: requireBool(
        settingsRaw.includeLinkedNotes,
        "settings.includeLinkedNotes",
      ),
    },
    totalTokenCount: requireNumber(obj.totalTokenCount, "totalTokenCount"),
    vcsProvider: requireString(obj.vcsProvider, "vcsProvider") as VCSKind,
    dirtyState: requireString(obj.dirtyState, "dirtyState") as Exclude<
      DirtyState,
      "unsafe_dirty"
    >,
    modifiedFiles: requireArray(
      obj.modifiedFiles ?? [],
      "modifiedFiles",
    ) as string[],
    trustModel: {
      sourceTree: requireString(
        trustModelRaw.sourceTree,
        "trustModel.sourceTree",
      ) as "trusted",
      notes: requireString(
        trustModelRaw.notes,
        "trustModel.notes",
      ) as "conditional",
      agentOutput: requireString(
        trustModelRaw.agentOutput,
        "trustModel.agentOutput",
      ) as "untrusted_until_verified",
      bundle: requireString(
        trustModelRaw.bundle,
        "trustModel.bundle",
      ) as "trusted",
    },
    traceability,
    sections,
    assets: assetsRaw.map((asset, index) => parseAssetDto(asset, index)),
    derivedReviewExports: derivedReviewExportsRaw.map((artifact, index) =>
      parseDerivedReviewExportDto(artifact, index),
    ),
    notes: notesRaw.map((note, index) => parseNoteDto(note, index)),
  };

  if (obj.handoverFile !== undefined) {
    dto.handoverFile = requireString(obj.handoverFile, "handoverFile");
  }

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
    checksumAlgorithm: manifest.checksumAlgorithm,
    settings: manifest.settings,
    totalTokenCount: manifest.totalTokenCount,
    vcsProvider: manifest.vcsProvider,
    dirtyState: manifest.dirtyState,
    modifiedFiles: manifest.modifiedFiles,
    trustModel: manifest.trustModel,
    traceability: manifest.traceability,
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
        ...(row.provenance !== undefined ? { provenance: row.provenance } : {}),
      })),
    })),
    assets: manifest.assets.map((asset) => ({
      sourcePath: asset.sourcePath,
      storedPath: asset.storedPath,
      sha256: asset.sha256,
      sizeBytes: asset.sizeBytes,
      mtime: asset.mtime,
      mediaType: asset.mediaType,
      ...(asset.provenance !== undefined
        ? { provenance: asset.provenance }
        : {}),
    })),
    ...(manifest.derivedReviewExports !== undefined
      ? { derivedReviewExports: manifest.derivedReviewExports }
      : {}),
    ...(manifest.notes !== undefined ? { notes: manifest.notes } : {}),
    ...(manifest.handoverFile !== undefined
      ? { handoverFile: manifest.handoverFile }
      : {}),
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
    ...(asset.provenance !== undefined ? { provenance: asset.provenance } : {}),
  }));

  const manifest: CxManifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    bundleVersion: 1,
    projectName: dto.projectName,
    sourceRoot: dto.sourceRoot,
    bundleDir: dto.bundleDir,
    checksumFile: dto.checksumFile,
    createdAt: dto.createdAt,
    cxVersion: dto.cxVersion,
    checksumAlgorithm: "sha256",
    settings: dto.settings,
    totalTokenCount: dto.totalTokenCount,
    vcsProvider: dto.vcsProvider as CxManifest["vcsProvider"],
    dirtyState: dto.dirtyState as CxManifest["dirtyState"],
    modifiedFiles: dto.modifiedFiles,
    trustModel: dto.trustModel,
    traceability: dto.traceability,
    sections,
    assets: dto.assets,
    ...(dto.derivedReviewExports !== undefined &&
    dto.derivedReviewExports.length > 0
      ? { derivedReviewExports: dto.derivedReviewExports }
      : {}),
    ...(dto.notes.length > 0 ? { notes: dto.notes } : {}),
    files: [...textRows, ...assetRows].sort((left, right) =>
      left.path.localeCompare(right.path, "en"),
    ),
  };

  if (dto.handoverFile !== undefined) {
    manifest.handoverFile = dto.handoverFile;
  }

  return manifest;
}
