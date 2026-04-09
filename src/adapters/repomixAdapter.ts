/**
 * Repomix adapter for cx CLI
 *
 * Responsibilities:
 *  - Scan a bundle folder containing repomix files + assets
 *  - Compute streaming SHA256 and metadata (size, lines, isBinary)
 *  - Write manifest.json and SHA256SUMS
 *  - Optionally produce a .zip archive of the bundle (streamed)
 *  - Parse repomix output files to list their contained files (XML or JSON)
 *
 * Notes:
 *  - Designed for Node 20+ and ESM.
 *  - Keeps production-grade error handling and deterministic ordering (sorted by path).
 */

import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { createReadStream } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import archiver from 'archiver';
import fg from 'fast-glob';

export type FileEntry = {
  path: string;        // relative path inside bundle (posix)
  absolutePath?: string; // optional absolute path on disk
  size: number;
  lines?: number;
  tokens?: number | null; // placeholder for token counts (use TokenCounter externally)
  sha256: string;
  mime?: string;
  isBinary: boolean;
};

export type BundleManifest = {
  format: string;
  createdAt: string;
  createdBy: string;
  repomixFiles: FileEntry[];
  assets: FileEntry[];
  metadata?: Record<string, unknown>;
};

const TEXT_FILE_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.md', '.markdown', '.txt', '.html',
  '.css', '.scss', '.yaml', '.yml', '.env',
  '.dockerfile', '.toml', '.ini', '.xml',
]);

async function isProbablyBinary(filePath: string): Promise<boolean> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext && TEXT_FILE_EXTS.has(ext)) return false;
  try {
    const fd = await fsPromises.open(filePath, 'r');
    const buf = Buffer.alloc(4096);
    const { bytesRead } = await fd.read(buf, 0, 4096, 0);
    await fd.close();
    for (let i = 0; i < bytesRead; i++) {
      if (buf[i] === 0) return true;
    }
    return false;
  } catch {
    return true;
  }
}

async function sha256File(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  const rs = createReadStream(filePath);
  await pipeline(rs, async function* (source) {
    for await (const chunk of source) {
      hash.update(chunk as Buffer);
      yield chunk;
    }
  });
  return hash.digest('hex');
}

async function countLines(filePath: string): Promise<number> {
  let lines = 0;
  const rs = createReadStream(filePath, { encoding: 'utf8' });
  for await (const chunk of rs) {
    for (let i = 0; i < (chunk as string).length; i++) {
      if ((chunk as string)[i] === '\n') lines++;
    }
  }
  return lines === 0 ? 0 : lines + 1;
}

function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

/**
 * Scan a bundle folder, classify files as repomix outputs or assets, and compute
 * SHA256, size, line count and binary detection for each file.
 *
 * Returns a BundleManifest (not yet written to disk).
 */
export async function scanBundleFolder(
  bundlePath: string,
  opts?: { includeHidden?: boolean; exclude?: string[] },
): Promise<BundleManifest> {
  const root = path.resolve(bundlePath);
  const excludeGlobs = opts?.exclude ?? ['**/node_modules/**', '**/.git/**'];

  const entries = await fg(['**/*'], {
    cwd: root,
    dot: !!opts?.includeHidden,
    ignore: excludeGlobs,
    onlyFiles: true,
    followSymbolicLinks: false,
  });

  // Classify: repomix output files vs other assets.
  // Skip manifest.json and SHA256SUMS since those are generated outputs.
  const GENERATED_FILES = new Set(['manifest.json', 'SHA256SUMS']);
  const isRepomixOutput = (p: string) =>
    /repomix[-_.]?output(\.(xml|json|txt|md))?$/i.test(path.basename(p));

  const repomixCandidates = entries
    .filter((p) => isRepomixOutput(p) && !GENERATED_FILES.has(path.basename(p)))
    .sort();
  const assetPaths = entries
    .filter((p) => !isRepomixOutput(p) && !GENERATED_FILES.has(path.basename(p)))
    .sort();

  async function buildEntry(rel: string): Promise<FileEntry> {
    const abs = path.join(root, rel);
    const stat = await fsPromises.stat(abs);
    const isBinary = await isProbablyBinary(abs);
    const sha256 = await sha256File(abs);
    const lines = isBinary ? undefined : await countLines(abs);
    return {
      path: toPosix(rel),
      absolutePath: abs,
      size: stat.size,
      lines,
      sha256,
      isBinary,
    };
  }

  const repomixFiles: FileEntry[] = await Promise.all(repomixCandidates.map(buildEntry));
  const assets: FileEntry[] = await Promise.all(assetPaths.map(buildEntry));

  return {
    format: 'cx-bundle-v1',
    createdAt: new Date().toISOString(),
    createdBy: 'cx-cli',
    repomixFiles,
    assets,
  };
}

/**
 * Write manifest.json and SHA256SUMS into the specified output directory.
 */
export async function writeManifestAndSha(
  manifest: BundleManifest,
  outputDir: string,
): Promise<{ manifestPath: string; sha256sumsPath: string }> {
  await fsPromises.mkdir(outputDir, { recursive: true });

  const manifestPath = path.join(outputDir, 'manifest.json');
  const sha256sumsPath = path.join(outputDir, 'SHA256SUMS');

  // Write manifest.json (strip absolutePath fields to keep it portable)
  const portable: BundleManifest = {
    ...manifest,
    repomixFiles: manifest.repomixFiles.map(({ absolutePath: _a, ...rest }) => rest),
    assets: manifest.assets.map(({ absolutePath: _a, ...rest }) => rest),
  };
  await fsPromises.writeFile(manifestPath, JSON.stringify(portable, null, 2) + '\n', 'utf8');

  // Write SHA256SUMS (GNU sha256sum compatible format)
  const allEntries = [...manifest.repomixFiles, ...manifest.assets];
  const lines = allEntries
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((e) => `${e.sha256}  ${e.path}`)
    .join('\n');
  await fsPromises.writeFile(sha256sumsPath, lines + '\n', 'utf8');

  return { manifestPath, sha256sumsPath };
}

/**
 * Create a zip archive streaming all files from the bundle folder.
 * Excludes generated files (manifest.json, SHA256SUMS) unless explicitly included.
 */
export async function createZipFromBundleFolder(
  bundlePath: string,
  zipPath: string,
  opts?: { includeGenerated?: boolean; exclude?: string[] },
): Promise<void> {
  const root = path.resolve(bundlePath);

  const GENERATED = ['manifest.json', 'SHA256SUMS'];
  const extraExclude = opts?.exclude ?? [];

  const filesToZip = await fg(['**/*'], {
    cwd: root,
    dot: false,
    ignore: ['**/node_modules/**', '**/.git/**', ...extraExclude],
    onlyFiles: true,
    followSymbolicLinks: false,
  });

  const filtered = filesToZip.filter(
    (f) => opts?.includeGenerated || !GENERATED.includes(path.basename(f)),
  );

  await fsPromises.mkdir(path.dirname(zipPath), { recursive: true });

  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);

    for (const rel of filtered.sort()) {
      archive.file(path.join(root, rel), { name: rel });
    }

    archive.finalize();
  });
}

type RepomixJsonFile = {
  path: string;
  content?: string;
};

type RepomixJsonOutput = {
  files: RepomixJsonFile[];
};

/**
 * Parse a repomix output file (XML or JSON) and return the list of file paths it contains.
 */
export async function parseRepomixFile(filePath: string): Promise<string[]> {
  const raw = await fsPromises.readFile(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(`Failed to parse JSON repomix file: ${filePath}: ${String(err)}`);
    }
    const output = parsed as RepomixJsonOutput;
    if (!Array.isArray(output?.files)) {
      throw new Error(`Unexpected JSON structure in repomix file: ${filePath}`);
    }
    return output.files.map((f) => f.path).sort();
  }

  // Default: treat as XML (repomix default output format)
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  let doc: unknown;
  try {
    doc = parser.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse XML repomix file: ${filePath}: ${String(err)}`);
  }

  // Repomix XML structure: <repository><file path="...">...</file></repository>
  const repo = (doc as Record<string, unknown>)?.repository as Record<string, unknown> | undefined;
  const files = repo?.file;

  if (!files) return [];

  const fileArray = Array.isArray(files) ? files : [files];
  return fileArray
    .map((f: unknown) => {
      const fileObj = f as Record<string, unknown>;
      return (fileObj?.['@_path'] as string) ?? '';
    })
    .filter(Boolean)
    .sort();
}

/**
 * Remove generated bundle artifacts: manifest.json, SHA256SUMS, and optionally zip files.
 */
export async function cleanupBundleGeneratedFiles(
  bundlePath: string,
  opts?: { zipName?: string; removeAllZips?: boolean },
): Promise<string[]> {
  const root = path.resolve(bundlePath);
  const removed: string[] = [];

  const toRemove: string[] = ['manifest.json', 'SHA256SUMS'];

  if (opts?.zipName) {
    toRemove.push(opts.zipName);
  } else if (opts?.removeAllZips) {
    const zips = await fg(['*.zip'], { cwd: root, onlyFiles: true });
    toRemove.push(...zips);
  }

  for (const name of toRemove) {
    const target = path.join(root, name);
    try {
      await fsPromises.unlink(target);
      removed.push(toPosix(path.relative(root, target)));
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }

  return removed;
}
