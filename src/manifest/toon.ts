import type { CxManifest, ManifestFileRow } from './types.js';
import { CxError } from '../shared/errors.js';

const FILE_TABLE_COLUMNS = [
  'path',
  'kind',
  'section',
  'stored_in',
  'sha256',
  'size_bytes',
  'media_type',
  'output_file',
  'output_start_line',
  'output_end_line',
] as const;

function encodeScalar(value: number | string): string {
  if (typeof value === 'number') {
    return String(value);
  }

  if (value === '-' || /^[A-Za-z0-9._/:+-]+$/.test(value)) {
    return value;
  }

  return JSON.stringify(value);
}

function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let index = 0;

  while (index < line.length) {
    while (line[index] === ' ') {
      index += 1;
    }

    if (index >= line.length) {
      break;
    }

    if (line[index] === '"') {
      let cursor = index + 1;
      let escaped = false;
      while (cursor < line.length) {
        const character = line[cursor]!;
        if (!escaped && character === '"') {
          break;
        }
        escaped = !escaped && character === '\\';
        cursor += 1;
      }

      tokens.push(JSON.parse(line.slice(index, cursor + 1)) as string);
      index = cursor + 1;
      continue;
    }

    let cursor = index;
    while (cursor < line.length && line[cursor] !== ' ') {
      cursor += 1;
    }

    tokens.push(line.slice(index, cursor));
    index = cursor;
  }

  return tokens;
}

function parseMaybeNumber(value: string): number | '-' {
  if (value === '-') {
    return '-';
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
  ].map(encodeScalar).join(' ');
}

export function renderManifestToon(manifest: CxManifest): string {
  const lines: string[] = [
    'bundle',
    `  schema_version ${manifest.schemaVersion}`,
    `  bundle_version ${manifest.bundleVersion}`,
    `  project_name ${encodeScalar(manifest.projectName)}`,
    `  source_root ${encodeScalar(manifest.sourceRoot)}`,
    `  bundle_dir ${encodeScalar(manifest.bundleDir)}`,
    `  checksum_file ${encodeScalar(manifest.checksumFile)}`,
    `  created_at ${encodeScalar(manifest.createdAt)}`,
    '',
    'tooling',
    `  cx_version ${encodeScalar(manifest.cxVersion)}`,
    `  repomix_version ${encodeScalar(manifest.repomixVersion)}`,
    `  checksum_algorithm ${manifest.checksumAlgorithm}`,
    '',
  ];

  for (const section of manifest.sections) {
    lines.push(`section ${encodeScalar(section.name)}`);
    lines.push(`  style ${section.style}`);
    lines.push(`  output_file ${encodeScalar(section.outputFile)}`);
    lines.push(`  output_sha256 ${section.outputSha256}`);
    lines.push(`  file_count ${section.fileCount}`);
    lines.push('');
  }

  for (const asset of manifest.assets) {
    lines.push('asset');
    lines.push(`  source_path ${encodeScalar(asset.sourcePath)}`);
    lines.push(`  stored_path ${encodeScalar(asset.storedPath)}`);
    lines.push(`  sha256 ${asset.sha256}`);
    lines.push(`  size_bytes ${asset.sizeBytes}`);
    lines.push(`  media_type ${encodeScalar(asset.mediaType)}`);
    lines.push('');
  }

  lines.push('table files');
  lines.push(`  ${FILE_TABLE_COLUMNS.join(' ')}`);
  for (const file of manifest.files) {
    lines.push(`  ${renderFileRow(file)}`);
  }
  lines.push('end');

  return `${lines.join('\n')}\n`;
}

export function parseManifestToon(source: string): CxManifest {
  const lines = source.split(/\r?\n/);
  const sections: CxManifest['sections'] = [];
  const assets: CxManifest['assets'] = [];
  const files: CxManifest['files'] = [];
  const bundleFields = new Map<string, string>();
  const toolingFields = new Map<string, string>();
  let currentAsset: Record<string, string> | null = null;
  let currentSection: Record<string, string> | null = null;
  let state: 'idle' | 'bundle' | 'tooling' | 'section' | 'asset' | 'table' = 'idle';

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.length === 0) {
      if (state === 'asset' && currentAsset) {
        assets.push({
          sourcePath: currentAsset.source_path!,
          storedPath: currentAsset.stored_path!,
          sha256: currentAsset.sha256!,
          sizeBytes: Number(currentAsset.size_bytes),
          mediaType: currentAsset.media_type!,
        });
        currentAsset = null;
        state = 'idle';
      } else if (state === 'section' && currentSection) {
        sections.push({
          name: currentSection.name!,
          style: currentSection.style as CxManifest['sections'][number]['style'],
          outputFile: currentSection.output_file!,
          outputSha256: currentSection.output_sha256!,
          fileCount: Number(currentSection.file_count),
        });
        currentSection = null;
        state = 'idle';
      }
      continue;
    }

    if (line === 'bundle') {
      state = 'bundle';
      continue;
    }
    if (line === 'tooling') {
      state = 'tooling';
      continue;
    }
    if (line.startsWith('section ')) {
      state = 'section';
      currentSection = { name: tokenize(line.slice('section '.length))[0]! };
      continue;
    }
    if (line === 'asset') {
      state = 'asset';
      currentAsset = {};
      continue;
    }
    if (line === 'table files') {
      state = 'table';
      continue;
    }
    if (line === 'end') {
      break;
    }

    if (state === 'table') {
      if (line.trimStart().startsWith(FILE_TABLE_COLUMNS[0])) {
        continue;
      }

      const fields = tokenize(line.trim());
      if (fields.length !== FILE_TABLE_COLUMNS.length) {
        throw new CxError(`Invalid manifest table row: ${line}`);
      }

      files.push({
        path: fields[0]!,
        kind: fields[1] as ManifestFileRow['kind'],
        section: fields[2] as ManifestFileRow['section'],
        storedIn: fields[3] as ManifestFileRow['storedIn'],
        sha256: fields[4]!,
        sizeBytes: Number(fields[5]),
        mediaType: fields[6]!,
        outputFile: fields[7] as ManifestFileRow['outputFile'],
        outputStartLine: parseMaybeNumber(fields[8]!),
        outputEndLine: parseMaybeNumber(fields[9]!),
      });
      continue;
    }

    const [key, ...rest] = tokenize(line.trim());
    const value = rest.join(' ');
    if (!key || value.length === 0) {
      throw new CxError(`Invalid manifest line: ${line}`);
    }

    switch (state) {
      case 'bundle':
        bundleFields.set(key, value);
        break;
      case 'tooling':
        toolingFields.set(key, value);
        break;
      case 'section':
        currentSection![key] = rest[0]!;
        break;
      case 'asset':
        currentAsset![key] = rest[0]!;
        break;
      default:
        throw new CxError(`Unexpected manifest content: ${line}`);
    }
  }

  if (currentSection) {
    sections.push({
      name: currentSection.name!,
      style: currentSection.style as CxManifest['sections'][number]['style'],
      outputFile: currentSection.output_file!,
      outputSha256: currentSection.output_sha256!,
      fileCount: Number(currentSection.file_count),
    });
  }

  if (currentAsset) {
    assets.push({
      sourcePath: currentAsset.source_path!,
      storedPath: currentAsset.stored_path!,
      sha256: currentAsset.sha256!,
      sizeBytes: Number(currentAsset.size_bytes),
      mediaType: currentAsset.media_type!,
    });
  }

  return {
    schemaVersion: 1,
    bundleVersion: 1,
    projectName: bundleFields.get('project_name')!,
    sourceRoot: bundleFields.get('source_root')!,
    bundleDir: bundleFields.get('bundle_dir')!,
    checksumFile: bundleFields.get('checksum_file')!,
    createdAt: bundleFields.get('created_at')!,
    cxVersion: toolingFields.get('cx_version')!,
    repomixVersion: toolingFields.get('repomix_version')!,
    checksumAlgorithm: 'sha256',
    sections,
    assets,
    files,
  };
}
