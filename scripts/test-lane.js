/**
 * Deterministic cross-platform test lane runner.
 *
 * Usage: node scripts/test-lane.js <dir> [--bun-config <path>] [bun-test-args...]
 *
 * Enumerates all *.test.ts files under <dir> in sorted order and forwards them
 * to `bun test`, ensuring the same file list on every OS regardless of shell
 * globbing behaviour.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { validateTestLaneHeaders } from "./test-lane-policy.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const [, , rawDir, ...rawArgs] = process.argv;

if (!rawDir) {
  console.error("test-lane: missing required argument <dir>");
  process.exit(1);
}

let bunConfig;
const extraArgs = [];

for (let index = 0; index < rawArgs.length; index += 1) {
  const arg = rawArgs[index];
  if (arg === "--bun-config") {
    bunConfig = rawArgs[index + 1];
    if (!bunConfig) {
      console.error("test-lane: missing value for --bun-config");
      process.exit(1);
    }
    index += 1;
    continue;
  }

  extraArgs.push(arg);
}

const targetDir = path.resolve(ROOT, rawDir);
const testsRoot = path.join(ROOT, "tests");

if (!fs.existsSync(targetDir)) {
  console.error(`test-lane: directory not found: ${targetDir}`);
  process.exit(1);
}

if (!path.relative(testsRoot, targetDir).startsWith("..")) {
  const { mismatches } = validateTestLaneHeaders(ROOT);
  if (mismatches.length > 0) {
    console.error("test-lane: lane policy violations detected:");
    for (const mismatch of mismatches) {
      console.error(`- ${mismatch}`);
    }
    process.exit(1);
  }
}

/**
 * Recursively enumerates *.test.ts files under `dir` in deterministic order
 * (directories before their siblings, entries sorted lexicographically).
 */
function collectTestFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTestFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      results.push(full);
    }
  }
  return results;
}

const files = collectTestFiles(targetDir);

if (files.length === 0) {
  console.error(`test-lane: no .test.ts files found under ${targetDir}`);
  process.exit(1);
}

try {
  const bunArgs = [];
  if (bunConfig) {
    bunArgs.push(`--config=${path.resolve(ROOT, bunConfig)}`);
  }
  bunArgs.push("test", ...files, ...extraArgs);

  await execa("bun", bunArgs, {
    stdio: "inherit",
    cwd: ROOT,
    env: process.env,
  });
} catch (error) {
  process.exit(
    error instanceof Error && "exitCode" in error
      ? Number(error.exitCode) || 1
      : 1,
  );
}
