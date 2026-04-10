import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createManifest, writeManifest } from '../adapters/repomixAdapter.js';
import { runList } from './list.js';

describe('list command', () => {
  let bundleDir: string;
  const logs: string[] = [];
  const originalLog = console.log;

  before(async () => {
    bundleDir = await mkdtemp(join(tmpdir(), 'cx-list-cli-'));
    await mkdir(bundleDir, { recursive: true });
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    };
  });

  after(async () => {
    console.log = originalLog;
    await rm(bundleDir, { recursive: true, force: true });
  });

  it('groups repomix component outputs by section when listing a bundle', async () => {
    const componentContent = `<repomix>
  <files>
    <file path="src/utils/output.ts">export function outputJson() {}</file>
    <file path=".beads/hooks/post-checkout">#!/bin/sh</file>
  </files>
</repomix>`;
    await writeFile(join(bundleDir, 'repomix-component-group-repo.xml.txt'), componentContent, 'utf8');

    const repomixOutputContent = `<repomix>
  <files>
    <file path="src/commands/list.ts">export async function runList() {}</file>
  </files>
</repomix>`;
    await writeFile(join(bundleDir, 'repomix-output.xml.txt'), repomixOutputContent, 'utf8');

    const manifest = createManifest(bundleDir, [
      {
        path: 'repomix-component-group-repo.xml.txt',
        size: Buffer.byteLength(componentContent, 'utf8'),
        sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        type: 'repomix',
      },
      {
        path: 'repomix-output.xml.txt',
        size: Buffer.byteLength(repomixOutputContent, 'utf8'),
        sha256: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        type: 'repomix',
      },
      {
        path: '.DS_Store',
        size: 6144,
        sha256: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        type: 'binary',
      },
      {
        path: 'SHA256SUMS',
        size: 179,
        sha256: 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
        type: 'checksum',
      },
    ]);

    await writeManifest(bundleDir, manifest);
    logs.length = 0;

    await runList(bundleDir, { verbose: true });

    assert.ok(logs.some((line) => line.includes('Section: group-repo')));
    assert.ok(logs.some((line) => line.includes('repomix-component-group-repo.xml.txt')));
    assert.ok(logs.some((line) => line.includes('  src/utils/output.ts')));
    assert.ok(logs.some((line) => line.includes('.DS_Store')));
  });

  it('includes section metadata in JSON output for repomix component files', async () => {
    const componentContent = `<repomix>
  <files>
    <file path="src/utils/output.ts">export function outputJson() {}</file>
  </files>
</repomix>`;
    await writeFile(join(bundleDir, 'repomix-component-group-repo.xml.txt'), componentContent, 'utf8');

    const manifest = createManifest(bundleDir, [
      {
        path: 'repomix-component-group-repo.xml.txt',
        size: Buffer.byteLength(componentContent, 'utf8'),
        sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        type: 'repomix',
      },
    ]);
    await writeManifest(bundleDir, manifest);

    const writes: string[] = [];
    const originalWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(typeof chunk === 'string' ? chunk : chunk.toString());
      return true;
    }) as typeof process.stdout.write;

    try {
      await runList(bundleDir, { json: true });
    } finally {
      process.stdout.write = originalWrite;
    }

    const result = JSON.parse(writes.join('')) as any;
    assert.equal(result.type, 'bundle');
    assert.ok(Array.isArray(result.files));
    assert.ok(result.files.some((file: any) => file.path === 'repomix-component-group-repo.xml.txt' && file.section === 'group-repo'));
    assert.ok(result.files.some((file: any) => Array.isArray(file.entries)));
  });
});
