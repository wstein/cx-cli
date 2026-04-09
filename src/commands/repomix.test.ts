/**
 * Unit tests for the `cx repomix` passthrough command.
 * Run with: node --experimental-strip-types --test src/commands/repomix.test.ts
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runRepomix } from './repomix.js';

describe('cx repomix command', () => {
  it('forwards arguments to the repomix CLI', async () => {
    await runRepomix(['--help']);
  });
});
