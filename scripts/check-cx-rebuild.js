#!/usr/bin/env node

import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
const BIN_CX = join(ROOT_DIR, 'bin', 'cx');
const DIST_INDEX = join(ROOT_DIR, 'dist', 'index.js');
const PACKAGE_JSON = join(ROOT_DIR, 'package.json');

if (!fs.existsSync(BIN_CX)) {
  throw new Error('Missing bin/cx shim.');
}
if (!fs.existsSync(DIST_INDEX)) {
  throw new Error('Missing dist/index.js; build the project first.');
}

function run(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Command failed with status ${result.status}`);
  }
}

const originalStat = fs.statSync(PACKAGE_JSON);
const originalMtime = originalStat.mtime;
const originalDistMtime = fs.statSync(DIST_INDEX).mtimeMs;
const touchedTime = new Date(Date.now() + 5000);
fs.utimesSync(PACKAGE_JSON, touchedTime, touchedTime);

try {
  console.log('check-cx-rebuild: verifying rebuild is triggered by stale source state');
  run([BIN_CX, '--help']);
  const rebuiltDistMtime = fs.statSync(DIST_INDEX).mtimeMs;
  if (rebuiltDistMtime <= originalDistMtime) {
    throw new Error('dist/index.js was not rebuilt after source timestamp was updated.');
  }
  console.log('check-cx-rebuild: rebuild behavior is correct.');
} finally {
  fs.utimesSync(PACKAGE_JSON, originalMtime, originalMtime);
}
