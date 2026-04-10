import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { runInit } from './init.js';

describe('init command', () => {
  let tempRoot: string;

  before(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'cx-init-test-'));
  });

  after(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  it('creates cx.json, repomix.config.json, and .repomixignore', async () => {
    await runInit({ cwd: tempRoot });

    const cxConfig = JSON.parse(await readFile(join(tempRoot, 'cx.json'), 'utf8'));
    assert.equal(cxConfig.version, '1');
    assert.deepEqual(cxConfig.repomix.outputStyle, 'xml');
    assert.deepEqual(cxConfig.bundle.outputDir, 'bundles');

    const repomixConfig = JSON.parse(await readFile(join(tempRoot, 'repomix.config.json'), 'utf8'));
    assert.equal(repomixConfig.output.style, 'xml');

    const ignoreContents = await readFile(join(tempRoot, '.repomixignore'), 'utf8');
    assert.ok(ignoreContents.includes('# Add patterns to ignore here'));
  });

  it('generates tsconfig.json when --ts is enabled', async () => {
    await runInit({ cwd: tempRoot, ts: true });

    const tsConfig = JSON.parse(await readFile(join(tempRoot, 'tsconfig.json'), 'utf8'));
    assert.equal(tsConfig.compilerOptions.module, 'Node16');
    assert.deepEqual(tsConfig.include, ['src']);
  });
});
