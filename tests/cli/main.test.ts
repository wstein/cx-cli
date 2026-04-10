import { describe, expect, test } from 'bun:test';

import { main } from '../../src/cli/main.js';

describe('main', () => {
  test('returns success for the current placeholder entry point', async () => {
    await expect(main([])).resolves.toBe(0);
  });
});
