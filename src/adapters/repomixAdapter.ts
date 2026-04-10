/**
 * repomixAdapter — core logic for scanning, hashing, parsing, and packaging
 * repomix bundle folders.
 *
 * A bundle is a directory that contains:
 *   - One or more repomix output files (XML, JSON, plain-text, or Markdown)
 *   - Zero or more binary assets (images, fonts, archives, …)
 *   - A generated `SHA256SUMS` checksum file
 *   - A generated `manifest.json` index
 *
 * All public functions are pure async operations with no side-effects beyond
 * the file-system writes they are explicitly designed for.
 */

import { createReadStream, createWriteStream } from 'node:fs';
import { access, constants, open, stat, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, extname, join, relative, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import archiver from 'archiver';
import fg from 'fast-glob';
import { XMLParser } from 'fast-xml-parser';
import { TokenCounter } from 'repomix';
import type { TiktokenEncoding } from 'tiktoken';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MANIFEST_FILENAME = 'manifest.json';
export const SHA256SUMS_FILENAME = 'SHA256SUMS';
export const BUNDLE_SCHEMA_VERSION = '1';

/** Extensions that are unconditionally treated as binary assets. */
const BINARY_EXTENSIONS = new Set([
  '.bmp', '.gif', '.ico', '.jpeg', '.jpg', '.png', '.svg', '.tiff', '.webp',
  '.pdf',
  '.7z', '.bz2', '.gz', '.rar', '.tar', '.xz', '.zip',
  '.a', '.dll', '.dylib', '.exe', '.lib', '.so', '.wasm',
  '.bin', '.dat',
  '.avi', '.mkv', '.mov', '.mp3', '.mp4', '.wav', '.webm',
  '.otf', '.ttf', '.woff', '.woff2',
  '.db', '.sqlite',
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Role of a file within a bundle. */
export type BundleFileType = 'repomix' | 'binary' | 'manifest' | 'checksum';

/** Metadata record for one file in the bundle. */
export interface BundleFile {
  /** Relative path from the bundle root. */
  path: string;
  /** File size in bytes. */
  size: number;
  /** Lowercase hex-encoded SHA-256 digest. */
  sha256: string;
  /** Semantic classification of the file. */
  type: BundleFileType;
}

/** Top-level manifest describing a bundle. */
export interface BundleManifest {
  /** Schema version, incremented on breaking changes. */
  schemaVersion: string;
  /** ISO-8601 timestamp of the most recent `cx bundle` run. */
  createdAt: string;
  /** Absolute path to the bundle directory on the host that created it. */
  bundlePath: string;
  /** All files in the bundle, sorted by path. */
  files: BundleFile[];
}

/** One source-file entry extracted from a repomix output file. */
export interface RepomixEntry {
  /** Repository-relative path of the original source file. */
  path: string;
  /** Full text content of the file as embedded by repomix. */
  content: string;
}

/** Parsed representation of a repomix output file. */
export interface ParsedRepomixOutput {
  /** Format detected from the output file. */
  style: 'xml' | 'json';
  /** Source-file entries packed inside the repomix output. */
  entries: RepomixEntry[];
  /** Directory tree string when present in the output. */
  directoryStructure?: string;
}

/** Options accepted by {@link processBundle}. */
export interface ProcessBundleOptions {
  /** When `true`, a ZIP archive is created alongside the bundle metadata. */
  createZip?: boolean;
  /**
   * Explicit output path for the ZIP archive.
   * Defaults to `<bundleDir>/<bundleDirName>.zip`.
   */
  zipOutputPath?: string;
  /** Additional fast-glob ignore patterns applied during directory scan. */
  exclude?: string[];
}

/** A file discovered during a bundle directory scan. */
export interface ScannedFile {
  absolutePath: string;
  relativePath: string;
}

// ---------------------------------------------------------------------------
// Internal XML parser (shared, stateless)
// ---------------------------------------------------------------------------

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
  parseTagValue: false,
  trimValues: false,
  // Always return `file` as an array, even for single entries.
  isArray: (name) => name === 'file',
});

// ---------------------------------------------------------------------------
// SHA-256 computation
// ---------------------------------------------------------------------------

/**
 * Compute the SHA-256 digest of a file using streaming I/O.
 *
 * @param filePath  Absolute or resolvable path to the file.
 * @returns Lowercase hex string.
 */
export async function computeSha256(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(filePath), hash);
  return hash.digest('hex');
}

// ---------------------------------------------------------------------------
// Head-byte reader (for format detection)
// ---------------------------------------------------------------------------

/**
 * Read the first `maxBytes` bytes of a file and return them as a UTF-8 string.
 * Used for lightweight format-detection without loading entire files.
 */
async function readHeadBytes(filePath: string, maxBytes = 512): Promise<string> {
  const fh = await open(filePath, 'r');
  try {
    const buf = Buffer.allocUnsafe(maxBytes);
    const { bytesRead } = await fh.read(buf, 0, maxBytes, 0);
    return buf.subarray(0, bytesRead).toString('utf8');
  } finally {
    await fh.close();
  }
}

// ---------------------------------------------------------------------------
// File classification
// ---------------------------------------------------------------------------

/**
 * Classify a bundle file based on its relative path and optional head bytes.
 *
 * @param relativePath  Path relative to the bundle root.
 * @param headBytes     First few bytes of the file for content-based detection.
 */
export function classifyFile(relativePath: string, headBytes?: string): BundleFileType {
  const name = basename(relativePath);
  if (name === MANIFEST_FILENAME) return 'manifest';
  if (name === SHA256SUMS_FILENAME) return 'checksum';

  const ext = extname(relativePath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) return 'binary';

  if (headBytes !== undefined) {
    const trimmed = headBytes.replace(/^\uFEFF/, '').trimStart();
    if (
      trimmed.startsWith('<repomix') ||
      trimmed.includes('<files>') ||
      trimmed.includes('This file is a merged representation')
    ) {
      return 'repomix';
    }
    if (trimmed.startsWith('{') && trimmed.includes('"files"')) {
      return 'repomix';
    }
  }

  return 'binary';
}

// ---------------------------------------------------------------------------
// Repomix output parsing
// ---------------------------------------------------------------------------

/**
 * Auto-detect the format and parse a repomix output file.
 *
 * Supports:
 *   - Parsable XML (`<repomix>` root element)
 *   - Non-parsable handlebar XML fragment (no root, but contains `<files>`)
 *   - JSON (`{ "files": { "path": "content", … } }` or array variant)
 *
 * @param filePath  Path to the repomix output file.
 * @throws If the file format cannot be detected or parsing fails.
 */
export async function parseRepomixFile(filePath: string): Promise<ParsedRepomixOutput> {
  const content = await readFile(filePath, 'utf8');
  const trimmed = content.replace(/^\uFEFF/, '').trimStart();

  if (trimmed.startsWith('<') || trimmed.startsWith('{')) {
    if (trimmed.startsWith('<')) return parseRepomixXml(content);
    return parseRepomixJson(content);
  }

  // Plain/Markdown repomix output — not machine-parsable into file entries.
  // We return an empty entries list so callers can still identify the format.
  if (trimmed.includes('This file is a merged representation')) {
    return { style: 'xml', entries: [] };
  }

  throw new Error(
    `Cannot determine repomix output format in "${filePath}". ` +
      'Only XML and JSON parsable styles are supported for entry listing.',
  );
}

function parseRepomixXml(content: string): ParsedRepomixOutput {
  const clean = content.replace(/^\uFEFF/, '');

  // Locate the first XML element.  The parsable style starts with <repomix>;
  // the handlebar style starts with a text preamble followed by XML fragments.
  const xmlStart = clean.search(/<(?:repomix|files|file_summary|directory_structure)\b/);
  if (xmlStart === -1) return { style: 'xml', entries: [] };

  let xmlContent = clean.slice(xmlStart);

  // Wrap non-rooted XML fragments so the parser sees a single root.
  if (!xmlContent.trimStart().startsWith('<repomix')) {
    xmlContent = `<repomix>${xmlContent}</repomix>`;
  }

  type FileNode = { '@_path'?: string; '#text'?: string };
  type XmlDoc = {
    repomix?: {
      files?: { file?: FileNode[] };
      directory_structure?: string;
    };
  };

  let doc: XmlDoc;
  try {
    doc = xmlParser.parse(xmlContent) as XmlDoc;
  } catch {
    return { style: 'xml', entries: [] };
  }

  const rawFiles = doc.repomix?.files?.file ?? [];
  const entries: RepomixEntry[] = rawFiles
    .filter((f): f is FileNode & { '@_path': string } => typeof f['@_path'] === 'string')
    .map((f) => ({ path: f['@_path'], content: f['#text'] ?? '' }));

  const dirStructure =
    typeof doc.repomix?.directory_structure === 'string'
      ? doc.repomix.directory_structure
      : undefined;

  return {
    style: 'xml',
    entries,
    ...(dirStructure !== undefined && { directoryStructure: dirStructure }),
  };
}

function parseRepomixJson(content: string): ParsedRepomixOutput {
  type JsonDoc = {
    files?: Record<string, string> | Array<{ path: string; content: string }>;
    directoryStructure?: string;
  };

  let doc: JsonDoc;
  try {
    doc = JSON.parse(content) as JsonDoc;
  } catch (err) {
    throw new Error(`Failed to parse repomix JSON output: ${String(err)}`);
  }

  if (!doc.files) return { style: 'json', entries: [] };

  const entries: RepomixEntry[] = Array.isArray(doc.files)
    ? doc.files.map((f) => ({ path: f.path, content: f.content }))
    : Object.entries(doc.files).map(([path, content]) => ({ path, content }));

  return {
    style: 'json',
    entries,
    ...(typeof doc.directoryStructure === 'string' && {
      directoryStructure: doc.directoryStructure,
    }),
  };
}

/**
 * Extract the final reported token count from repomix output content.
 *
 * Repomix output files may include embedded source text with incidental
 * occurrences of "Total tokens:". We therefore prefer the last reported
 * value in the file, which corresponds to the actual repomix summary.
 */
export function extractTotalTokens(fileContent: string): number | undefined {
  const pattern = /Total tokens:\s*([\d,]+)/gi;
  let lastMatch: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(fileContent)) !== null) {
    lastMatch = match;
  }

  if (lastMatch === null) return undefined;
  const tokenText = lastMatch[1] ?? '';
  if (tokenText.length === 0) return undefined;
  return Number(tokenText.replace(/,/g, ''));
}

export function countFileTokens(content: string, encoding: TiktokenEncoding = 'o200k_base'): number {
  const counter = new TokenCounter(encoding);
  try {
    return counter.countTokens(content);
  } finally {
    counter.free();
  }
}

// ---------------------------------------------------------------------------
// Bundle directory scan
// ---------------------------------------------------------------------------

/**
 * Recursively list all files in `bundlePath`, sorted lexicographically for
 * deterministic output.
 *
 * @param bundlePath  Path to the bundle directory.
 * @param exclude     Additional fast-glob ignore patterns.
 */
export async function scanBundleFolder(
  bundlePath: string,
  exclude: string[] = [],
): Promise<ScannedFile[]> {
  const abs = resolve(bundlePath);
  const ignored = ['**/.git/**', '**/node_modules/**', ...exclude];

  const relPaths = await fg(['**/*'], {
    cwd: abs,
    dot: true,
    ignore: ignored,
    onlyFiles: true,
  });

  relPaths.sort(); // deterministic ordering

  return relPaths.map((rel) => ({ absolutePath: join(abs, rel), relativePath: rel }));
}

// ---------------------------------------------------------------------------
// SHA256SUMS writer
// ---------------------------------------------------------------------------

/**
 * Write a GNU-compatible `SHA256SUMS` file to `bundlePath`.
 *
 * Data files (type ≠ `'checksum'`) are included; the checksum file itself is
 * omitted to avoid circularity.
 */
export async function writeSha256Sums(bundlePath: string, files: BundleFile[]): Promise<void> {
  const lines = files
    .filter((f) => f.type !== 'checksum')
    .map((f) => `${f.sha256}  ${f.path}`);

  await writeFile(join(bundlePath, SHA256SUMS_FILENAME), lines.join('\n') + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// Manifest helpers
// ---------------------------------------------------------------------------

/** Build an in-memory {@link BundleManifest} from a list of bundle files. */
export function createManifest(bundlePath: string, files: BundleFile[]): BundleManifest {
  return {
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    bundlePath: resolve(bundlePath),
    files,
  };
}

/** Serialize and write `manifest.json` to `bundlePath`. */
export async function writeManifest(bundlePath: string, manifest: BundleManifest): Promise<void> {
  await writeFile(
    join(bundlePath, MANIFEST_FILENAME),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8',
  );
}

/** Read and deserialize `manifest.json` from `bundlePath`. */
export async function readManifest(bundlePath: string): Promise<BundleManifest> {
  const raw = await readFile(join(bundlePath, MANIFEST_FILENAME), 'utf8');
  return JSON.parse(raw) as BundleManifest;
}

export interface VerifyBundleResult {
  valid: boolean;
  checkedFiles: number;
  totalManifestFiles: number;
  totalChecksumEntries: number;
  errors: string[];
  warnings: string[];
}

export async function verifyBundle(bundlePath: string): Promise<VerifyBundleResult> {
  const abs = resolve(bundlePath);
  const manifest = await readManifest(abs);
  const sha256sumsPath = join(abs, SHA256SUMS_FILENAME);
  const sha256sumsText = await readFile(sha256sumsPath, 'utf8');
  const checksums = parseSha256Sums(sha256sumsText);

  const errors: string[] = [];
  const warnings: string[] = [];
  const dataFiles = manifest.files.filter((f) => f.type !== 'checksum' && f.type !== 'manifest');
  const checksumPaths = Object.keys(checksums);
  const manifestPaths = new Set(dataFiles.map((f) => f.path));

  for (const file of dataFiles) {
    if (!checksums[file.path]) {
      errors.push(`Missing SHA256SUMS entry for ${file.path}`);
      continue;
    }
    if (checksums[file.path] !== file.sha256) {
      errors.push(
        `Manifest SHA256 mismatch for ${file.path}: manifest=${file.sha256} SHA256SUMS=${checksums[file.path]}`,
      );
    }
  }

  for (const path of checksumPaths) {
    if (!manifestPaths.has(path)) {
      warnings.push(`SHA256SUMS contains an extra path not listed in manifest: ${path}`);
    }
  }

  let checkedFiles = 0;
  for (const file of dataFiles) {
    const filePath = join(abs, file.path);
    let actualHash: string;
    try {
      actualHash = await computeSha256(filePath);
    } catch (err) {
      errors.push(`Failed to read ${file.path}: ${String(err)}`);
      continue;
    }
    checkedFiles += 1;
    const expectedHash = checksums[file.path];
    if (expectedHash === undefined) continue;
    if (actualHash !== expectedHash) {
      errors.push(`SHA256 checksum mismatch for ${file.path}: expected=${expectedHash} actual=${actualHash}`);
    }
  }

  const checksumFileEntry = manifest.files.find((f) => f.type === 'checksum');
  if (!checksumFileEntry) {
    errors.push(`${SHA256SUMS_FILENAME} is missing from manifest.json`);
  } else {
    const checksumHash = await computeSha256(sha256sumsPath);
    if (checksumHash !== checksumFileEntry.sha256) {
      errors.push(
        `manifest.json contains wrong SHA256 for ${SHA256SUMS_FILENAME}: manifest=${checksumFileEntry.sha256} actual=${checksumHash}`,
      );
    }
  }

  const valid = errors.length === 0;
  return {
    valid,
    checkedFiles,
    totalManifestFiles: manifest.files.length,
    totalChecksumEntries: checksumPaths.length,
    errors,
    warnings,
  };
}

function parseSha256Sums(content: string): Record<string, string> {
  const lines = content.split(/\r?\n/);
  const result: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    const match = /^([0-9a-f]{64})\s+(.+)$/.exec(trimmed);
    if (!match) continue;
    const hash = match[1]!;
    const path = match[2]!;
    result[path] = hash;
  }

  return result;
}

// ---------------------------------------------------------------------------
// ZIP archive creation
// ---------------------------------------------------------------------------

/**
 * Create a streaming ZIP archive at `outputPath` containing the listed
 * bundle files.
 *
 * @param bundlePath  Root directory that the relative paths in `files` resolve against.
 * @param files       Files to include (relative `path` field is used as the archive entry name).
 * @param outputPath  Destination path for the ZIP file.
 */
export async function createZipArchive(
  bundlePath: string,
  files: readonly BundleFile[],
  outputPath: string,
): Promise<void> {
  const abs = resolve(bundlePath);

  await new Promise<void>((res, rej) => {
    const output = createWriteStream(outputPath);
    const arc = archiver('zip', { zlib: { level: 9 } });

    output.once('close', res);
    arc.once('error', rej);

    arc.pipe(output);

    for (const file of files) {
      arc.file(join(abs, file.path), { name: file.path });
    }

    void arc.finalize();
  });
}

// ---------------------------------------------------------------------------
// Main bundle processor
// ---------------------------------------------------------------------------

/**
 * Process a bundle directory:
 *
 * 1. Scan all files (excluding previously generated metadata).
 * 2. Compute a streaming SHA-256 for each file.
 * 3. Write `SHA256SUMS` (data-file hashes only).
 * 4. Write `manifest.json` (all files including `SHA256SUMS`).
 * 5. Optionally create a ZIP archive of the complete bundle.
 *
 * @param bundlePath  Path to the bundle directory.
 * @param options     Processing options.
 * @returns The written manifest.
 */
export async function processBundle(
  bundlePath: string,
  options: ProcessBundleOptions = {},
): Promise<BundleManifest> {
  const abs = resolve(bundlePath);

  // Verify the directory is accessible.
  await access(abs, constants.R_OK | constants.W_OK);

  const scanned = await scanBundleFolder(abs, options.exclude);

  const dataFiles: BundleFile[] = [];

  for (const entry of scanned) {
    // Skip previously generated metadata so we produce a clean result.
    const name = basename(entry.relativePath);
    if (name === MANIFEST_FILENAME || name === SHA256SUMS_FILENAME) continue;

    const [fileStat, sha256] = await Promise.all([
      stat(entry.absolutePath),
      computeSha256(entry.absolutePath),
    ]);

    const headBytes = BINARY_EXTENSIONS.has(extname(entry.relativePath).toLowerCase())
      ? undefined
      : await readHeadBytes(entry.absolutePath);

    dataFiles.push({
      path: entry.relativePath,
      size: fileStat.size,
      sha256,
      type: classifyFile(entry.relativePath, headBytes),
    });
  }

  // Write SHA256SUMS for data files, then record its own hash in the manifest.
  await writeSha256Sums(abs, dataFiles);

  const [sha256sumsStat, sha256sumsHash] = await Promise.all([
    stat(join(abs, SHA256SUMS_FILENAME)),
    computeSha256(join(abs, SHA256SUMS_FILENAME)),
  ]);

  const allFiles: BundleFile[] = [
    ...dataFiles,
    {
      path: SHA256SUMS_FILENAME,
      size: sha256sumsStat.size,
      sha256: sha256sumsHash,
      type: 'checksum',
    },
  ];

  const manifest = createManifest(abs, allFiles);
  await writeManifest(abs, manifest);

  if (options.createZip === true) {
    // Include manifest.json in the archive (it has been written by now).
    const manifestStat = await stat(join(abs, MANIFEST_FILENAME));
    const manifestHash = await computeSha256(join(abs, MANIFEST_FILENAME));
    const archiveFiles: BundleFile[] = [
      ...allFiles,
      {
        path: MANIFEST_FILENAME,
        size: manifestStat.size,
        sha256: manifestHash,
        type: 'manifest',
      },
    ];

    const zipPath =
      options.zipOutputPath ?? join(abs, `${basename(abs)}.zip`);
    await createZipArchive(abs, archiveFiles, zipPath);
  }

  return manifest;
}
