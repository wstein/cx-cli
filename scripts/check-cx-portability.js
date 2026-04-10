#!/usr/bin/env node

import fs from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
const BIN_CX = join(ROOT_DIR, 'bin', 'cx');
const content = fs.readFileSync(BIN_CX, 'utf8');

if (!content.startsWith('#!/usr/bin/env node')) {
  throw new Error('bin/cx must use a Node shebang for platform neutrality.');
}

if (!/process\.platform|import .* from 'node:fs'|from 'node:url'/.test(content)) {
  throw new Error('bin/cx should rely on Node runtime APIs for cross-platform behavior.');
}

console.log('check-cx-portability: bin/cx is Node-based and platform-neutral.');
