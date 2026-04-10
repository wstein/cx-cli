import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { runBundle } from './bundle.js';

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
});
