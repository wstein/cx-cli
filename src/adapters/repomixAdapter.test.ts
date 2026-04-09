/**
 * Tests for repomixAdapter
 *
 * Uses Node.js built-in test runner (node:test) — no external test framework needed.
 */

import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, describe, before, after } from 'node:test';

import {
  scanBundleFolder,
  writeManifestAndSha,
  parseRepomixFile,
  cleanupBundleGeneratedFiles,
  createZipFromBundleFolder,
} from './repomixAdapter.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeTmpDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'cx-test-'));
}

const REPOMIX_XML_CONTENT = `<?xml version="1.0" encoding="UTF-8"?>
<repomix version="1.0">
  <files>
    <file path="src/index.ts">export const x = 1;
</file>
    <file path="src/utils.ts">export function noop() {}
</file>
    <file path="README.md"># Project
</file>
  </files>
</repomix>`;

const REPOMIX_JSON_CONTENT = JSON.stringify({
  files: [
    { path: 'src/alpha.ts', content: 'const a = 1;', charCount: 12 },
    { path: 'src/beta.ts', content: 'const b = 2;', charCount: 12 },
  ],
});

// ---------------------------------------------------------------------------
// parseRepomixFile
// ---------------------------------------------------------------------------

describe('parseRepomixFile', () => {
  let tmpDir: string;

  before(async () => {
    tmpDir = await makeTmpDir();
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test('parses XML repomix output', async () => {
    const filePath = path.join(tmpDir, 'repomix-output.xml');
    await writeFile(filePath, REPOMIX_XML_CONTENT, 'utf8');

    const entries = await parseRepomixFile(filePath);
    assert.equal(entries.length, 3);
    assert.equal(entries[0]?.path, 'src/index.ts');
    assert.equal(entries[1]?.path, 'src/utils.ts');
    assert.equal(entries[2]?.path, 'README.md');
  });

  test('parses JSON repomix output', async () => {
    const filePath = path.join(tmpDir, 'repomix-output.json');
    await writeFile(filePath, REPOMIX_JSON_CONTENT, 'utf8');

    const entries = await parseRepomixFile(filePath);
    assert.equal(entries.length, 2);
    assert.equal(entries[0]?.path, 'src/alpha.ts');
    assert.equal(entries[0]?.charCount, 12);
    assert.equal(entries[1]?.path, 'src/beta.ts');
  });

  test('returns empty array for empty XML', async () => {
    const filePath = path.join(tmpDir, 'empty.xml');
    await writeFile(filePath, '<repomix></repomix>', 'utf8');
    const entries = await parseRepomixFile(filePath);
    assert.deepEqual(entries, []);
  });

  test('returns empty array for malformed JSON', async () => {
    const filePath = path.join(tmpDir, 'bad.json');
    await writeFile(filePath, '{ not valid json', 'utf8');
    const entries = await parseRepomixFile(filePath);
    assert.deepEqual(entries, []);
  });
});

// ---------------------------------------------------------------------------
// scanBundleFolder + writeManifestAndSha
// ---------------------------------------------------------------------------

describe('scanBundleFolder', () => {
  let bundleDir: string;

  before(async () => {
    bundleDir = await makeTmpDir();
    await writeFile(path.join(bundleDir, 'repomix-output.xml'), REPOMIX_XML_CONTENT, 'utf8');
    await writeFile(path.join(bundleDir, 'notes.txt'), 'Some notes\n', 'utf8');
    await writeFile(path.join(bundleDir, 'image.png'), 'fakepng\n', 'utf8');
  });

  after(async () => {
    await rm(bundleDir, { recursive: true, force: true });
  });

  test('classifies repomix output files correctly', async () => {
    const manifest = await scanBundleFolder(bundleDir);
    assert.equal(manifest.repomixFiles.length, 1);
    assert.equal(manifest.repomixFiles[0]?.path, 'repomix-output.xml');
  });

  test('classifies other files as assets', async () => {
    const manifest = await scanBundleFolder(bundleDir);
    const assetPaths = manifest.assets.map(a => a.path).sort();
    assert.deepEqual(assetPaths, ['image.png', 'notes.txt']);
  });

  test('each entry has a sha256, size and isBinary field', async () => {
    const manifest = await scanBundleFolder(bundleDir);
    const allEntries = [...manifest.repomixFiles, ...manifest.assets];
    for (const entry of allEntries) {
      assert.match(entry.sha256, /^[0-9a-f]{64}$/, `sha256 for ${entry.path}`);
      assert.ok(typeof entry.size === 'number' && entry.size >= 0);
      assert.ok(typeof entry.isBinary === 'boolean');
    }
  });

  test('manifest has correct format and createdBy', async () => {
    const manifest = await scanBundleFolder(bundleDir);
    assert.equal(manifest.format, 'cx-bundle/v1');
    assert.equal(manifest.createdBy, 'cx-cli');
    assert.ok(manifest.createdAt);
  });

  test('excludes manifest.json and SHA256SUMS from scan', async () => {
    // Write generated artefacts first.
    await writeFile(path.join(bundleDir, 'manifest.json'), '{}', 'utf8');
    await writeFile(path.join(bundleDir, 'SHA256SUMS'), '', 'utf8');

    const manifest = await scanBundleFolder(bundleDir);
    const allPaths = [
      ...manifest.repomixFiles.map(f => f.path),
      ...manifest.assets.map(a => a.path),
    ];
    assert.ok(!allPaths.includes('manifest.json'));
    assert.ok(!allPaths.includes('SHA256SUMS'));
  });
});

// ---------------------------------------------------------------------------
// writeManifestAndSha
// ---------------------------------------------------------------------------

describe('writeManifestAndSha', () => {
  let bundleDir: string;

  before(async () => {
    bundleDir = await makeTmpDir();
    await writeFile(path.join(bundleDir, 'repomix-output.xml'), REPOMIX_XML_CONTENT, 'utf8');
  });

  after(async () => {
    await rm(bundleDir, { recursive: true, force: true });
  });

  test('writes valid manifest.json', async () => {
    const manifest = await scanBundleFolder(bundleDir);
    await writeManifestAndSha(bundleDir, manifest);

    const raw = await readFile(path.join(bundleDir, 'manifest.json'), 'utf8');
    const parsed = JSON.parse(raw);
    assert.equal(parsed.format, 'cx-bundle/v1');
    assert.ok(Array.isArray(parsed.repomixFiles));
    assert.ok(Array.isArray(parsed.assets));
  });

  test('writes SHA256SUMS with correct format', async () => {
    const manifest = await scanBundleFolder(bundleDir);
    await writeManifestAndSha(bundleDir, manifest);

    const raw = await readFile(path.join(bundleDir, 'SHA256SUMS'), 'utf8');
    const lines = raw.trim().split('\n');
    for (const line of lines) {
      // sha256sum format: <64-hex-chars><two-spaces><path>
      assert.match(line, /^[0-9a-f]{64}  .+$/);
    }
  });

  test('SHA256SUMS entries are sorted by path', async () => {
    const manifest = await scanBundleFolder(bundleDir);
    await writeManifestAndSha(bundleDir, manifest);

    const raw = await readFile(path.join(bundleDir, 'SHA256SUMS'), 'utf8');
    const paths = raw
      .trim()
      .split('\n')
      .map(l => l.split('  ')[1] ?? '');
    const sorted = [...paths].sort();
    assert.deepEqual(paths, sorted);
  });
});

// ---------------------------------------------------------------------------
// cleanupBundleGeneratedFiles
// ---------------------------------------------------------------------------

describe('cleanupBundleGeneratedFiles', () => {
  let bundleDir: string;

  before(async () => {
    bundleDir = await makeTmpDir();
  });

  after(async () => {
    await rm(bundleDir, { recursive: true, force: true });
  });

  test('removes manifest.json and SHA256SUMS when present', async () => {
    await writeFile(path.join(bundleDir, 'manifest.json'), '{}', 'utf8');
    await writeFile(path.join(bundleDir, 'SHA256SUMS'), '', 'utf8');

    const removed = await cleanupBundleGeneratedFiles(bundleDir);
    assert.deepEqual(removed.sort(), ['SHA256SUMS', 'manifest.json']);
  });

  test('does not throw when files are absent', async () => {
    const removed = await cleanupBundleGeneratedFiles(bundleDir);
    assert.deepEqual(removed, []);
  });

  test('removes named zip when zipName is provided', async () => {
    const zipName = 'test.bundle.zip';
    await writeFile(path.join(bundleDir, zipName), 'fake-zip', 'utf8');

    const removed = await cleanupBundleGeneratedFiles(bundleDir, { zipName });
    assert.ok(removed.includes(zipName));
  });
});

// ---------------------------------------------------------------------------
// createZipFromBundleFolder
// ---------------------------------------------------------------------------

describe('createZipFromBundleFolder', () => {
  let bundleDir: string;
  let zipPath: string;

  before(async () => {
    bundleDir = await makeTmpDir();
    zipPath = path.join(tmpdir(), 'test-bundle.zip');
    await writeFile(path.join(bundleDir, 'repomix-output.xml'), REPOMIX_XML_CONTENT, 'utf8');
    await writeFile(path.join(bundleDir, 'notes.txt'), 'hello\n', 'utf8');
  });

  after(async () => {
    await rm(bundleDir, { recursive: true, force: true });
    await rm(zipPath, { force: true });
  });

  test('creates a non-empty zip file', async () => {
    await createZipFromBundleFolder(bundleDir, zipPath);

    const stat = await import('node:fs/promises').then(m => m.stat(zipPath));
    assert.ok(stat.size > 0, 'ZIP should be non-empty');
  });
});
