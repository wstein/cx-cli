/**
 * Unit tests for the `cx repomix` passthrough command.
 * Run with: node --experimental-strip-types --test src/commands/repomix.test.ts
 */

import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { resolveRepomixEntryPoint, runRepomix } from './repomix.js';

describe('cx repomix command', () => {
  it('resolves the local repomix CLI entrypoint', async () => {
    const entry = await resolveRepomixEntryPoint();
    const stats = await stat(entry);
    assert.ok(stats.isFile(), `Expected repomix entrypoint to be a file: ${entry}`);
  });

  it('forwards arguments to the repomix CLI', async () => {
    await runRepomix(['--help']);
  });
});
