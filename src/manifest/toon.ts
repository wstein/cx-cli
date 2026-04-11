import { CxError } from "../shared/errors.js";
import type { CxManifest, ManifestFileRow } from "./types.js";

const FILE_TABLE_COLUMNS = [
  "path",
  "kind",
  "section",
  "stored_in",
  "sha256",
  "size_bytes",
  "media_type",
  "output_file",
  "output_start_line",
  "output_end_line",
  "exact_content_b64",
] as const;

function encodeScalar(value: number | string): string {
  if (typeof value === "number") {
    return String(value);
  }

  if (value === "-" || /^[A-Za-z0-9._/:+-]+$/.test(value)) {
    return value;
  }

  return JSON.stringify(value);
}

function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let index = 0;

  while (index < line.length) {
    while (line[index] === " ") {
      index += 1;
    }

    if (index >= line.length) {
      break;
    }

    if (line[index] === '"') {
      let cursor = index + 1;
      let escaped = false;
      while (cursor < line.length) {
        const character = line[cursor];
        if (character === undefined) {
          throw new CxError(`Invalid quoted token: ${line}`);
        }
        if (!escaped && character === '"') {
          break;
        }
        escaped = !escaped && character === "\\";
        cursor += 1;
      }

      tokens.push(JSON.parse(line.slice(index, cursor + 1)) as string);
      index = cursor + 1;
      continue;
    }

    let cursor = index;
    while (cursor < line.length && line[cursor] !== " ") {
      cursor += 1;
    }

    tokens.push(line.slice(index, cursor));
    index = cursor;
  }

  return tokens;
}

function requireToken(value: string | undefined, label: string): string {
  if (value === undefined || value.length === 0) {
    throw new CxError(`Missing ${label} in manifest.`);
  }
  return value;
}

function parseSectionRecord(section: Record<string, string>) {
  return {
    name: requireToken(section.name, "section name"),
    style: requireToken(
      section.style,
      "section style",
    ) as CxManifest["sections"][number]["style"],
    outputFile: requireToken(section.output_file, "section output_file"),
    outputSha256: requireToken(section.output_sha256, "section output_sha256"),
    fileCount: Number(requireToken(section.file_count, "section file_count")),
    losslessTextExtraction:
      requireToken(
        section.lossless_text_extraction,
        "section lossless_text_extraction",
      ) === "true",
  };
}

function parseAssetRecord(asset: Record<string, string>) {
  return {
    sourcePath: requireToken(asset.source_path, "asset source_path"),
    storedPath: requireToken(asset.stored_path, "asset stored_path"),
    sha256: requireToken(asset.sha256, "asset sha256"),
    sizeBytes: Number(requireToken(asset.size_bytes, "asset size_bytes")),
    mediaType: requireToken(asset.media_type, "asset media_type"),
  };
}

function parseMaybeNumber(value: string): number | "-" {
  if (value === "-") {
    return "-";
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new CxError(`Invalid numeric field in manifest: ${value}.`);
  }
  return parsed;
}

function renderFileRow(row: ManifestFileRow): string {
  return [
    row.path,
    row.kind,
    row.section,
    row.storedIn,
    row.sha256,
    row.sizeBytes,
    row.mediaType,
    row.outputFile,
    row.outputStartLine,
    row.outputEndLine,
    row.exactContentBase64,
  ]
    .map(encodeScalar)
    .join(" ");
}

export function renderManifestToon(manifest: CxManifest): string {
  const lines: string[] = [
    "bundle",
    `  schema_version ${manifest.schemaVersion}`,
    `  bundle_version ${manifest.bundleVersion}`,
    `  project_name ${encodeScalar(manifest.projectName)}`,
    `  source_root ${encodeScalar(manifest.sourceRoot)}`,
    `  bundle_dir ${encodeScalar(manifest.bundleDir)}`,
    `  checksum_file ${encodeScalar(manifest.checksumFile)}`,
    `  created_at ${encodeScalar(manifest.createdAt)}`,
    "",
    "tooling",
    `  cx_version ${encodeScalar(manifest.cxVersion)}`,
    `  repomix_version ${encodeScalar(manifest.repomixVersion)}`,
    `  checksum_algorithm ${manifest.checksumAlgorithm}`,
    "",
    "settings",
    `  global_style ${manifest.settings.globalStyle}`,
    `  remove_comments ${String(manifest.settings.removeComments)}`,
    `  remove_empty_lines ${String(manifest.settings.removeEmptyLines)}`,
    `  compress ${String(manifest.settings.compress)}`,
    `  show_line_numbers ${String(manifest.settings.showLineNumbers)}`,
    `  include_empty_directories ${String(manifest.settings.includeEmptyDirectories)}`,
    `  security_check ${String(manifest.settings.securityCheck)}`,
    `  lossless_text_extraction ${String(manifest.settings.losslessTextExtraction)}`,
    "",
  ];

  for (const section of manifest.sections) {
    lines.push(`section ${encodeScalar(section.name)}`);
    lines.push(`  style ${section.style}`);
    lines.push(`  output_file ${encodeScalar(section.outputFile)}`);
    lines.push(`  output_sha256 ${section.outputSha256}`);
    lines.push(`  file_count ${section.fileCount}`);
    lines.push(
      `  lossless_text_extraction ${String(section.losslessTextExtraction)}`,
    );
    lines.push("");
  }

  for (const asset of manifest.assets) {
    lines.push("asset");
    lines.push(`  source_path ${encodeScalar(asset.sourcePath)}`);
    lines.push(`  stored_path ${encodeScalar(asset.storedPath)}`);
    lines.push(`  sha256 ${asset.sha256}`);
    lines.push(`  size_bytes ${asset.sizeBytes}`);
    lines.push(`  media_type ${encodeScalar(asset.mediaType)}`);
    lines.push("");
  }

  lines.push("table files");
  lines.push(`  ${FILE_TABLE_COLUMNS.join(" ")}`);

  const groupedFiles = new Map<string, ManifestFileRow[]>();
  for (const file of manifest.files) {
    const group = groupedFiles.get(file.outputFile);
    if (group) {
      group.push(file);
    } else {
      groupedFiles.set(file.outputFile, [file]);
    }
  }

  for (const outputFile of Array.from(groupedFiles.keys()).sort()) {
    lines.push(`  output_file ${encodeScalar(outputFile)}`);
    for (const file of groupedFiles.get(outputFile) ?? []) {
      lines.push(`  ${renderFileRow(file)}`);
    }
    lines.push("");
  }

  lines.push("end");

  return `${lines.join("\n")}\n`;
}

export function parseManifestToon(source: string): CxManifest {
  const lines = source.split(/\r?\n/);
  const sections: CxManifest["sections"] = [];
  const assets: CxManifest["assets"] = [];
  const files: CxManifest["files"] = [];
  const bundleFields = new Map<string, string>();
  const toolingFields = new Map<string, string>();
  const settingsFields = new Map<string, string>();
  let currentAsset: Record<string, string> | null = null;
  let currentSection: Record<string, string> | null = null;
  let state:
    | "idle"
    | "bundle"
    | "tooling"
    | "settings"
    | "section"
    | "asset"
    | "table" = "idle";

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.length === 0) {
      if (state === "asset" && currentAsset) {
        assets.push(parseAssetRecord(currentAsset));
        currentAsset = null;
        state = "idle";
      } else if (state === "section" && currentSection) {
        sections.push(parseSectionRecord(currentSection));
        currentSection = null;
        state = "idle";
      }
      continue;
    }

    if (line === "bundle") {
      state = "bundle";
      continue;
    }
    if (line === "tooling") {
      state = "tooling";
      continue;
    }
    if (line === "settings") {
      state = "settings";
      continue;
    }
    if (line.startsWith("section ")) {
      state = "section";
      currentSection = {
        name: requireToken(
          tokenize(line.slice("section ".length))[0],
          "section name",
        ),
      };
      continue;
    }
    if (line === "asset") {
      state = "asset";
      currentAsset = {};
      continue;
    }
    if (line === "table files") {
      state = "table";
      continue;
    }
    if (line === "end") {
      break;
    }

    if (state === "table") {
      if (line.trimStart().startsWith(FILE_TABLE_COLUMNS[0])) {
        continue;
      }

      if (line.trimStart().startsWith("output_file ")) {
        continue;
      }

      const fields = tokenize(line.trim());
      if (fields.length !== FILE_TABLE_COLUMNS.length) {
        throw new CxError(`Invalid manifest table row: ${line}`);
      }

      files.push({
        path: requireToken(fields[0], "file path"),
        kind: fields[1] as ManifestFileRow["kind"],
        section: fields[2] as ManifestFileRow["section"],
        storedIn: fields[3] as ManifestFileRow["storedIn"],
        sha256: requireToken(fields[4], "file sha256"),
        sizeBytes: Number(fields[5]),
        mediaType: requireToken(fields[6], "file media_type"),
        outputFile: fields[7] as ManifestFileRow["outputFile"],
        outputStartLine: parseMaybeNumber(
          requireToken(fields[8], "file output_start_line"),
        ),
        outputEndLine: parseMaybeNumber(
          requireToken(fields[9], "file output_end_line"),
        ),
        exactContentBase64: fields[10] as ManifestFileRow["exactContentBase64"],
      });
      continue;
    }

    const [key, ...rest] = tokenize(line.trim());
    const value = rest.join(" ");
    if (!key || value.length === 0) {
      throw new CxError(`Invalid manifest line: ${line}`);
    }

    switch (state) {
      case "bundle":
        bundleFields.set(key, value);
        break;
      case "tooling":
        toolingFields.set(key, value);
        break;
      case "settings":
        settingsFields.set(key, value);
        break;
      case "section":
        if (!currentSection) {
          throw new CxError("Unexpected section state in manifest.");
        }
        currentSection[key] = requireToken(rest[0], `section field ${key}`);
        break;
      case "asset":
        if (!currentAsset) {
          throw new CxError("Unexpected asset state in manifest.");
        }
        currentAsset[key] = requireToken(rest[0], `asset field ${key}`);
        break;
      default:
        throw new CxError(`Unexpected manifest content: ${line}`);
    }
  }

  if (currentSection) {
    sections.push(parseSectionRecord(currentSection));
  }

  if (currentAsset) {
    assets.push(parseAssetRecord(currentAsset));
  }

  return {
    schemaVersion: 1,
    bundleVersion: 1,
    projectName: requireToken(bundleFields.get("project_name"), "project_name"),
    sourceRoot: requireToken(bundleFields.get("source_root"), "source_root"),
    bundleDir: requireToken(bundleFields.get("bundle_dir"), "bundle_dir"),
    checksumFile: requireToken(
      bundleFields.get("checksum_file"),
      "checksum_file",
    ),
    createdAt: requireToken(bundleFields.get("created_at"), "created_at"),
    cxVersion: requireToken(toolingFields.get("cx_version"), "cx_version"),
    repomixVersion: requireToken(
      toolingFields.get("repomix_version"),
      "repomix_version",
    ),
    checksumAlgorithm: "sha256",
    settings: {
      globalStyle: settingsFields.get(
        "global_style",
      ) as CxManifest["settings"]["globalStyle"],
      removeComments: settingsFields.get("remove_comments") === "true",
      removeEmptyLines: settingsFields.get("remove_empty_lines") === "true",
      compress: settingsFields.get("compress") === "true",
      showLineNumbers: settingsFields.get("show_line_numbers") === "true",
      includeEmptyDirectories:
        settingsFields.get("include_empty_directories") === "true",
      securityCheck: settingsFields.get("security_check") === "true",
      losslessTextExtraction:
        settingsFields.get("lossless_text_extraction") === "true",
    },
    sections,
    assets,
    files,
  };
}
