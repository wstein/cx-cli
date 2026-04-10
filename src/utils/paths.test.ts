import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { expandTilde, resolveConfigPath, resolveConfigFilePath } from './paths.js';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

describe('path utils', () => {
  it('expands home directory shorthand', () => {
    const home = homedir();
    assert.equal(expandTilde('~/cx-cli'), resolve(home, 'cx-cli'));
    assert.equal(expandTilde('~'), home);
  });

  it('resolves a relative config path against the config directory', () => {
    const base = resolve('/tmp/project');
    assert.equal(resolveConfigPath(base, 'bundles'), resolve(base, 'bundles'));
  });

  it('resolves an absolute config path unchanged', () => {
    const path = resolve('/var/tmp/cx-bundle');
    assert.equal(resolveConfigPath('/tmp/project', path), path);
  });

  it('resolves a config file path relative to cwd', () => {
    const path = resolveConfigFilePath('/tmp/project', 'cx.json');
    assert.equal(path, resolve('/tmp/project', 'cx.json'));
  });
});
