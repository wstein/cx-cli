/**
 * Tests for repomixAdapter.ts
 *
 * Uses Node's built-in test facilities via Jest and in-memory fixtures.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  scanBundleFolder,
  writeManifestAndSha,
  createZipFromBundleFolder,
  parseRepomixFile,
  cleanupBundleGeneratedFiles,
  type BundleManifest,
} from '../src/adapters/repomixAdapter.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'cx-test-'));
});

afterEach(async () => {
  await fsPromises.rm(tmpDir, { recursive: true, force: true });
});

// ── helpers ───────────────────────────────────────────────────────────────────

async function writeFile(rel: string, content: string): Promise<void> {
  const abs = path.join(tmpDir, rel);
  await fsPromises.mkdir(path.dirname(abs), { recursive: true });
  await fsPromises.writeFile(abs, content, 'utf8');
}

// ── scanBundleFolder ──────────────────────────────────────────────────────────

describe('scanBundleFolder', () => {
  it('returns empty manifest for empty folder', async () => {
    const manifest = await scanBundleFolder(tmpDir);
    expect(manifest.repomixFiles).toHaveLength(0);
    expect(manifest.assets).toHaveLength(0);
    expect(manifest.format).toBe('cx-bundle-v1');
  });

  it('classifies repomix output files separately from assets', async () => {
    await writeFile('repomix-output.xml', '<repository/>');
    await writeFile('logo.png', 'binarydata');
    await writeFile('notes.md', '# notes');

    const manifest = await scanBundleFolder(tmpDir);
    expect(manifest.repomixFiles).toHaveLength(1);
    expect(manifest.repomixFiles[0].path).toBe('repomix-output.xml');
    expect(manifest.assets).toHaveLength(2);
    const assetPaths = manifest.assets.map((a) => a.path).sort();
    expect(assetPaths).toEqual(['logo.png', 'notes.md']);
  });

  it('computes sha256 for each file', async () => {
    await writeFile('repomix-output.xml', '<repository/>');
    const manifest = await scanBundleFolder(tmpDir);
    expect(manifest.repomixFiles[0].sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('skips manifest.json and SHA256SUMS', async () => {
    await writeFile('manifest.json', '{}');
    await writeFile('SHA256SUMS', 'abc  file.txt');
    await writeFile('repomix-output.xml', '<repository/>');

    const manifest = await scanBundleFolder(tmpDir);
    expect(manifest.repomixFiles).toHaveLength(1);
    expect(manifest.assets).toHaveLength(0);
  });

  it('reports line count for text files', async () => {
    await writeFile('repomix-output.xml', '<repository>\n<file path="a.ts">content</file>\n</repository>');
    const manifest = await scanBundleFolder(tmpDir);
    expect(manifest.repomixFiles[0].lines).toBeGreaterThan(0);
  });
});

// ── writeManifestAndSha ───────────────────────────────────────────────────────

describe('writeManifestAndSha', () => {
  it('writes manifest.json and SHA256SUMS', async () => {
    await writeFile('repomix-output.xml', '<repository/>');
    const manifest = await scanBundleFolder(tmpDir);
    const { manifestPath, sha256sumsPath } = await writeManifestAndSha(manifest, tmpDir);

    const raw = await fsPromises.readFile(manifestPath, 'utf8');
    const parsed: BundleManifest = JSON.parse(raw);
    expect(parsed.format).toBe('cx-bundle-v1');
    expect(parsed.repomixFiles).toHaveLength(1);

    const sums = await fsPromises.readFile(sha256sumsPath, 'utf8');
    expect(sums).toMatch(/[0-9a-f]{64}  repomix-output\.xml/);
  });

  it('manifest does not contain absolutePath', async () => {
    await writeFile('repomix-output.xml', '<repository/>');
    const manifest = await scanBundleFolder(tmpDir);
    const { manifestPath } = await writeManifestAndSha(manifest, tmpDir);
    const raw = await fsPromises.readFile(manifestPath, 'utf8');
    expect(raw).not.toContain('absolutePath');
  });
});

// ── createZipFromBundleFolder ─────────────────────────────────────────────────

describe('createZipFromBundleFolder', () => {
  it('creates a zip file', async () => {
    await writeFile('repomix-output.xml', '<repository/>');
    await writeFile('notes.md', '# notes');
    const zipPath = path.join(tmpDir, 'bundle.zip');

    await createZipFromBundleFolder(tmpDir, zipPath);

    const stat = await fsPromises.stat(zipPath);
    expect(stat.size).toBeGreaterThan(0);
  });
});

// ── parseRepomixFile ──────────────────────────────────────────────────────────

describe('parseRepomixFile', () => {
  it('parses XML repomix output', async () => {
    const xml = `<?xml version="1.0"?>
<repository>
  <file path="src/index.ts">content</file>
  <file path="src/utils.ts">content</file>
</repository>`;
    await writeFile('repomix-output.xml', xml);

    const files = await parseRepomixFile(path.join(tmpDir, 'repomix-output.xml'));
    expect(files).toEqual(['src/index.ts', 'src/utils.ts']);
  });

  it('parses JSON repomix output', async () => {
    const json = JSON.stringify({
      files: [
        { path: 'src/a.ts', content: '...' },
        { path: 'src/b.ts', content: '...' },
      ],
    });
    await writeFile('repomix-output.json', json);

    const files = await parseRepomixFile(path.join(tmpDir, 'repomix-output.json'));
    expect(files).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('returns sorted file paths', async () => {
    const xml = `<repository>
  <file path="z.ts">z</file>
  <file path="a.ts">a</file>
  <file path="m.ts">m</file>
</repository>`;
    await writeFile('repomix-output.xml', xml);

    const files = await parseRepomixFile(path.join(tmpDir, 'repomix-output.xml'));
    expect(files).toEqual(['a.ts', 'm.ts', 'z.ts']);
  });

  it('throws on invalid JSON', async () => {
    await writeFile('bad.json', '{not valid}');
    await expect(parseRepomixFile(path.join(tmpDir, 'bad.json'))).rejects.toThrow();
  });
});

// ── cleanupBundleGeneratedFiles ───────────────────────────────────────────────

describe('cleanupBundleGeneratedFiles', () => {
  it('removes manifest.json and SHA256SUMS', async () => {
    await writeFile('manifest.json', '{}');
    await writeFile('SHA256SUMS', 'abc  file.txt');

    const removed = await cleanupBundleGeneratedFiles(tmpDir);
    expect(removed).toContain('manifest.json');
    expect(removed).toContain('SHA256SUMS');

    await expect(fsPromises.access(path.join(tmpDir, 'manifest.json'))).rejects.toThrow();
    await expect(fsPromises.access(path.join(tmpDir, 'SHA256SUMS'))).rejects.toThrow();
  });

  it('does not throw if files are absent', async () => {
    const removed = await cleanupBundleGeneratedFiles(tmpDir);
    expect(removed).toHaveLength(0);
  });

  it('removes named zip with --zip-name', async () => {
    await writeFile('manifest.json', '{}');
    await writeFile('SHA256SUMS', '');
    await writeFile('bundle.zip', 'PK');

    const removed = await cleanupBundleGeneratedFiles(tmpDir, { zipName: 'bundle.zip' });
    expect(removed).toContain('bundle.zip');
  });

  it('removes all zips with --all-zips', async () => {
    await writeFile('manifest.json', '{}');
    await writeFile('SHA256SUMS', '');
    await writeFile('a.zip', 'PK');
    await writeFile('b.zip', 'PK');

    const removed = await cleanupBundleGeneratedFiles(tmpDir, { removeAllZips: true });
    expect(removed).toContain('a.zip');
    expect(removed).toContain('b.zip');
  });
});
