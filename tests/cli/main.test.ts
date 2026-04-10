import { describe, expect, test } from 'bun:test';

import { main } from '../../src/cli/main.js';

describe('main', () => {
  test('prints init template to stdout', async () => {
    const write = process.stdout.write;
    let output = '';
    process.stdout.write = ((chunk: string | Uint8Array) => {
      output += String(chunk);
      return true;
    }) as typeof process.stdout.write;

    await expect(main(['init', '--stdout'])).resolves.toBe(0);
    process.stdout.write = write;
    expect(output).toContain('schema_version = 1');
  });
});
