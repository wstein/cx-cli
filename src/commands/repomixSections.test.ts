import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { extractSections, shouldGenerateComponent } from './repomixSections.js';

describe('repomix sections extraction', () => {
  it('parses string section entries correctly', () => {
    const config = {
      sections: {
        frontend: 'src/frontend',
      },
    };

    const components = extractSections(config);

    assert.deepStrictEqual(components, [
      { name: 'src/frontend', include: ['src/frontend'] },
    ]);
  });

  it('parses array section entries as group names', () => {
    const config = {
      sections: {
        ui: ['src/ui', 'src/shared'],
      },
    };

    const components = extractSections(config);

    assert.deepStrictEqual(components, [
      { name: 'group-ui', include: ['src/ui', 'src/shared'] },
    ]);
  });

  it('parses object section entries with explicit names', () => {
    const config = {
      sections: {
        api: {
          name: 'backend',
          include: ['src/api', 'src/lib'],
        },
      },
    };

    const components = extractSections(config);

    assert.deepStrictEqual(components, [
      { name: 'backend', include: ['src/api', 'src/lib'] },
    ]);
  });

  it('throws when sections is absent', () => {
    assert.throws(
      () => extractSections({}),
      /No `sections` field found/,
    );
  });

  it('skips section regeneration when sources are older than outputs', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'cx-sections-'));
    const sourceDir = join(tempRoot, 'src');
    await mkdir(sourceDir, { recursive: true });
    const sourceFile = join(sourceDir, 'file.txt');
    await writeFile(sourceFile, 'hello', 'utf8');

    const cxConfigFile = join(tempRoot, 'cx.json');
    await writeFile(cxConfigFile, JSON.stringify({ sections: { test: 'src/file.txt' } }, null, 2), 'utf8');

    const repomixConfigFile = join(tempRoot, 'repomix.config.json');
    await writeFile(repomixConfigFile, JSON.stringify({ output: { style: 'xml' } }, null, 2), 'utf8');

    const outputFile = join(tempRoot, 'repomix-component-test.xml.txt');
    await writeFile(outputFile, 'generated', 'utf8');

    const fresh = await shouldGenerateComponent(
      outputFile,
      tempRoot,
      ['src/file.txt'],
      cxConfigFile,
      repomixConfigFile,
    );

    assert.equal(fresh, false);
    await rm(tempRoot, { recursive: true, force: true });
  });

  it('regenerates sections when source files are newer than outputs', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'cx-sections-'));
    const sourceDir = join(tempRoot, 'src');
    await mkdir(sourceDir, { recursive: true });
    const sourceFile = join(sourceDir, 'file.txt');
    await writeFile(sourceFile, 'hello', 'utf8');

    const outputFile = join(tempRoot, 'repomix-component-test.xml.txt');
    await writeFile(outputFile, 'generated', 'utf8');

    await new Promise((resolve) => setTimeout(resolve, 10));
    await writeFile(sourceFile, 'hello world', 'utf8');

    const cxConfigFile = join(tempRoot, 'cx.json');
    await writeFile(cxConfigFile, JSON.stringify({ sections: { test: 'src/file.txt' } }, null, 2), 'utf8');

    const repomixConfigFile = join(tempRoot, 'repomix.config.json');
    await writeFile(repomixConfigFile, JSON.stringify({ output: { style: 'xml' } }, null, 2), 'utf8');

    const fresh = await shouldGenerateComponent(
      outputFile,
      tempRoot,
      ['src/file.txt'],
      cxConfigFile,
      repomixConfigFile,
    );

    assert.equal(fresh, true);
    await rm(tempRoot, { recursive: true, force: true });
  });
});
