/**
 * Unit tests for repomixAdapter core functions.
 * Run with: node --experimental-strip-types --test src/adapters/repomixAdapter.test.ts
 */

import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, before, after } from 'node:test';
import {
  classifyFile,
  computeSha256,
  countFileTokens,
  extractTotalTokens,
  MANIFEST_FILENAME,
  SHA256SUMS_FILENAME,
  parseRepomixFile,
  processBundle,
} from './repomixAdapter.js';

// ---------------------------------------------------------------------------
// classifyFile
// ---------------------------------------------------------------------------

describe('classifyFile', () => {
  it('classifies manifest.json as manifest', () => {
    assert.equal(classifyFile('manifest.json'), 'manifest');
    assert.equal(classifyFile('sub/dir/manifest.json'), 'manifest');
  });

  it('classifies SHA256SUMS as checksum', () => {
    assert.equal(classifyFile('SHA256SUMS'), 'checksum');
    assert.equal(classifyFile('sub/SHA256SUMS'), 'checksum');
  });

  it('classifies known binary extensions as binary', () => {
    for (const ext of ['.png', '.jpg', '.gif', '.svg', '.pdf', '.zip', '.wasm']) {
      assert.equal(classifyFile(`file${ext}`), 'binary', `expected binary for ${ext}`);
    }
  });

  it('classifies XML repomix file by head bytes', () => {
    assert.equal(classifyFile('output.xml', '<repomix><files></files></repomix>'), 'repomix');
    assert.equal(classifyFile('output.txt', '<files><file path="x">y</file></files>'), 'repomix');
  });

  it('classifies JSON repomix file by head bytes', () => {
    assert.equal(classifyFile('output.json', '{"files":{"src/a.ts":"content"}}'), 'repomix');
  });

  it('classifies plain repomix output by header text', () => {
    assert.equal(
      classifyFile('output.txt', 'This file is a merged representation of the repo'),
      'repomix',
    );
  });

  it('falls back to binary for unknown text files without head bytes', () => {
    assert.equal(classifyFile('data.csv'), 'binary');
  });
});

// ---------------------------------------------------------------------------
// computeSha256
// ---------------------------------------------------------------------------

describe('computeSha256', () => {
  let tmpDir: string;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'cx-test-'));
  });

  after(async () => {
    await rm(tmpDir, { recursive: true });
  });

  it('produces a stable 64-character hex digest', async () => {
    const file = join(tmpDir, 'sample.txt');
    await writeFile(file, 'hello cx\n', 'utf8');
    const hash = await computeSha256(file);
    assert.match(hash, /^[0-9a-f]{64}$/);
  });

  it('produces the same digest on repeated calls', async () => {
    const file = join(tmpDir, 'stable.txt');
    await writeFile(file, 'deterministic content', 'utf8');
    const hash1 = await computeSha256(file);
    const hash2 = await computeSha256(file);
    assert.equal(hash1, hash2);
  });

  it('produces different digests for different content', async () => {
    const f1 = join(tmpDir, 'a.txt');
    const f2 = join(tmpDir, 'b.txt');
    await writeFile(f1, 'content A', 'utf8');
    await writeFile(f2, 'content B', 'utf8');
    assert.notEqual(await computeSha256(f1), await computeSha256(f2));
  });
});

// ---------------------------------------------------------------------------
// extractTotalTokens
// ---------------------------------------------------------------------------

describe('extractTotalTokens', () => {
  it('returns the last reported total token count in repomix output', () => {
    const content = `Total tokens: 1\nconst x = 2;\nTotal tokens: 34,739 tokens`;
    assert.equal(extractTotalTokens(content), 34739);
  });

  it('returns undefined when no total token summary is present', () => {
    const content = 'No token summary here';
    assert.equal(extractTotalTokens(content), undefined);
  });
});

describe('countFileTokens', () => {
  it('counts tokens for arbitrary repomix output content', () => {
    const content = '<repomix><files><file path="a.ts">const x = 1;</file></files></repomix>';
    const count = countFileTokens(content);
    assert.ok(count > 0, 'expected a positive token count');
  });
});

// ---------------------------------------------------------------------------
// parseRepomixFile
// ---------------------------------------------------------------------------

describe('parseRepomixFile', () => {
  let tmpDir: string;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'cx-parse-'));
  });

  after(async () => {
    await rm(tmpDir, { recursive: true });
  });

  it('parses parsable XML output', async () => {
    const xml = `<repomix>
  <files>
    <file path="src/a.ts">const a = 1;</file>
    <file path="src/b.ts">const b = 2;</file>
  </files>
</repomix>`;
    const file = join(tmpDir, 'repomix-output.xml');
    await writeFile(file, xml, 'utf8');
    const result = await parseRepomixFile(file);
    assert.equal(result.style, 'xml');
    assert.equal(result.entries.length, 2);
    assert.equal(result.entries[0]?.path, 'src/a.ts');
    assert.equal(result.entries[1]?.path, 'src/b.ts');
  });

  it('parses component-style XML output with standalone file entries', async () => {
    const xml = `This file is a merged representation of a subset of the codebase.

<file_summary>
  <file path="src/app.ts">console.log('hello');</file>
  <file path="src/util.ts">export const x = 1;</file>
</file_summary>`;
    const file = join(tmpDir, 'repomix-component-group-repo.xml.txt');
    await writeFile(file, xml, 'utf8');
    const result = await parseRepomixFile(file);
    assert.equal(result.style, 'xml');
    assert.equal(result.entries.length, 2);
    assert.equal(result.entries[0]?.path, 'src/app.ts');
    assert.equal(result.entries[1]?.path, 'src/util.ts');
  });

  it('parses JSON output with files as object', async () => {
    const json = JSON.stringify({
      files: { 'src/index.ts': 'export default 42;', 'README.md': '# Hello' },
    });
    const file = join(tmpDir, 'repomix-output.json');
    await writeFile(file, json, 'utf8');
    const result = await parseRepomixFile(file);
    assert.equal(result.style, 'json');
    assert.equal(result.entries.length, 2);
  });

  it('returns empty entries for unrecognised plain text', async () => {
    const file = join(tmpDir, 'plain.txt');
    await writeFile(
      file,
      'This file is a merged representation of the repository',
      'utf8',
    );
    const result = await parseRepomixFile(file);
    assert.equal(result.entries.length, 0);
  });
});

// ---------------------------------------------------------------------------
// processBundle (integration)
// ---------------------------------------------------------------------------

describe('processBundle', () => {
  let bundleDir: string;

  before(async () => {
    bundleDir = await mkdtemp(join(tmpdir(), 'cx-bundle-'));
    await writeFile(join(bundleDir, 'repomix-output.xml'), '<repomix><files><file path="a.ts">x</file></files></repomix>', 'utf8');
    await writeFile(join(bundleDir, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  after(async () => {
    await rm(bundleDir, { recursive: true });
  });

  it('creates manifest.json and SHA256SUMS', async () => {
    const manifest = await processBundle(bundleDir);
    assert.equal(manifest.schemaVersion, '1');
    assert.ok(manifest.files.length >= 3);

    const names = manifest.files.map((f) => f.path);
    assert.ok(names.includes(SHA256SUMS_FILENAME));
    assert.ok(!names.includes(MANIFEST_FILENAME), 'manifest should not be inside itself');
  });

  it('data files are sorted and SHA256SUMS is last', async () => {
    const manifest = await processBundle(bundleDir);
    const paths = manifest.files.map((f) => f.path);
    const dataFiles = paths.filter((p) => p !== SHA256SUMS_FILENAME);
    const sorted = [...dataFiles].sort();
    // Data files are sorted; SHA256SUMS is always appended last.
    assert.deepEqual(dataFiles, sorted);
    assert.equal(paths[paths.length - 1], SHA256SUMS_FILENAME);
  });

  it('all sha256 values are 64-char hex strings', async () => {
    const manifest = await processBundle(bundleDir);
    for (const file of manifest.files) {
      assert.match(file.sha256, /^[0-9a-f]{64}$/, `bad hash for ${file.path}`);
    }
  });
});
