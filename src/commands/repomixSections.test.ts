import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractSections } from './repomixSections.js';

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
});
