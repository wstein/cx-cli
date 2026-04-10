import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { runBundle } from './bundle.js';
import { countFileTokens } from '../adapters/repomixAdapter.js';

describe('bundle command', () => {
  let bundleDir: string;
  const logs: string[] = [];
  const originalLog = console.log;

  before(async () => {
    bundleDir = await mkdtemp(join(tmpdir(), 'cx-bundle-cli-'));
    await writeFile(join(bundleDir, 'repomix-output.xml'), '<repomix><files><file path="a.ts">x</file></files></repomix>', 'utf8');
    await writeFile(join(bundleDir, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    };
  });

  after(async () => {
    console.log = originalLog;
    await rm(bundleDir, { recursive: true, force: true });
  });

  it('prints verbose bundle details when enabled', async () => {
    await runBundle(bundleDir, { verbose: true });

    assert.ok(logs.some((line) => line.includes('Bundling:')));
    assert.ok(logs.some((line) => line.includes('written to')));
    assert.ok(logs.some((line) => line.includes('Detailed bundle contents:')));
    assert.ok(logs.some((line) => line.includes('repomix-output.xml')));
    assert.ok(logs.some((line) => line.includes('logo.png')));
  });

  it('prints repomix artifact stats in the bundle summary', async () => {
    logs.length = 0;
    const tokenFile = `Total tokens: 1\n<repomix><files><file path="a.ts">x</file></files></repomix>`;
    const expectedTokens = countFileTokens(tokenFile);
    await writeFile(join(bundleDir, 'repomix-output.xml'), tokenFile, 'utf8');

    await runBundle(bundleDir, {});

    assert.ok(logs.some((line) => line.includes('📊 Bundle Summary:')));
    assert.ok(logs.some((line) => line.includes(`Total Tokens: ${expectedTokens.toLocaleString()} tokens`)));
    assert.ok(logs.some((line) => line.includes('Total Chars:')));
    assert.ok(logs.some((line) => line.includes('repomix-output.xml')));
    assert.ok(logs.some((line) => line.includes('tokens')));
    assert.ok(logs.some((line) => line.includes('bytes')));
    assert.ok(logs.some((line) => line.includes('%')));
  });

  it('outputs machine-readable JSON when --json is enabled', async () => {
    const writes: string[] = [];
    const originalWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(typeof chunk === 'string' ? chunk : chunk.toString());
      return true;
    }) as typeof process.stdout.write;

    try {
      await runBundle(bundleDir, { json: true });
    } finally {
      process.stdout.write = originalWrite;
    }

    const result = JSON.parse(writes.join('')) as any;
    assert.equal(result.bundlePath, bundleDir);
    assert.equal(result.totalFiles, 3);
    assert.equal(result.repomixFiles, 1);
    assert.equal(result.binaryFiles, 1);
    assert.ok(typeof result.repomixSummary === 'object' && result.repomixSummary !== null);
  });

  it('resolves bundle outputDir from cx.json when no path is provided', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'cx-bundle-config-'));
    const bundleDir = join(tempRoot, 'bundle-dir');
    await mkdir(bundleDir, { recursive: true });
    await writeFile(
      join(tempRoot, 'cx.json'),
      JSON.stringify({
        version: '1',
        repomix: {
          configFile: 'repomix.config.json',
          outputStyle: 'xml',
          outputDir: 'bundles',
        },
        bundle: {
          outputDir: 'bundle-dir',
          createZip: false,
        },
      }, null, 2) + '\n',
      'utf8',
    );

    const expectedBundleRoot = resolve(bundleDir);
    logs.length = 0;

    await runBundle(undefined, { cxConfig: join(tempRoot, 'cx.json') });

    assert.ok(logs.some((line) => line.includes(`Bundling: ${expectedBundleRoot}`)));

    await rm(tempRoot, { recursive: true, force: true });
  });
});
