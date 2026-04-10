import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { runVerify } from './verify.js';
import { processBundle } from '../adapters/repomixAdapter.js';

describe('verify command', () => {
  let bundleDir: string;
  const logs: string[] = [];
  const originalLog = console.log;

  before(async () => {
    bundleDir = await mkdtemp(join(tmpdir(), 'cx-verify-cli-'));
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    };
  });

  after(async () => {
    console.log = originalLog;
    await rm(bundleDir, { recursive: true, force: true });
  });

  it('verifies a healthy bundle successfully', async () => {
    await writeFile(join(bundleDir, 'repomix-output.xml'), '<repomix><files><file path="a.ts">x</file></files></repomix>', 'utf8');
    await writeFile(join(bundleDir, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    await processBundle(bundleDir);

    logs.length = 0;
    await runVerify(bundleDir, { verbose: true });

    assert.ok(logs.some((line) => line.includes('Bundle verified successfully')));
    assert.ok(logs.some((line) => line.includes('Data files checked:')));
  });

  it('fails verification when a file hash changes after bundling', async () => {
    await writeFile(join(bundleDir, 'repomix-output.xml'), '<repomix><files><file path="a.ts">x</file></files></repomix>', 'utf8');
    await processBundle(bundleDir);
    await writeFile(join(bundleDir, 'repomix-output.xml'), '<repomix><files><file path="a.ts">changed</file></files></repomix>', 'utf8');

    logs.length = 0;
    await assert.rejects(async () => runVerify(bundleDir), {
      message: 'Bundle verification failed',
    });

    assert.ok(logs.some((line) => line.includes('Bundle verification failed')));
  });
});
