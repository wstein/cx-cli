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
import {
  ALLOWED_LANES,
  collectTestFiles,
  parseLaneHeader,
  validateTestLaneHeaders,
} from "./test-lane-policy.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const [, , rawDir, ...rawArgs] = process.argv;

if (!rawDir) {
  console.error("test-lane: missing required argument <dir>");
  process.exit(1);
}

let bunConfig;
const selectedLanes = new Set();
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
  if (arg === "--lane") {
    const lane = rawArgs[index + 1];
    if (!lane) {
      console.error("test-lane: missing value for --lane");
      process.exit(1);
    }
    if (!ALLOWED_LANES.has(lane)) {
      console.error(
        `test-lane: invalid lane "${lane}" (expected one of ${[
          ...ALLOWED_LANES,
        ].join(", ")})`,
      );
      process.exit(1);
    }
    selectedLanes.add(lane);
    index += 1;
    continue;
  }

  extraArgs.push(arg);
}

const targetDir = path.resolve(ROOT, rawDir);
const testsRoot = path.join(ROOT, "tests");
const targetWithinTests = !path.relative(testsRoot, targetDir).startsWith("..");

if (!fs.existsSync(targetDir)) {
  console.error(`test-lane: directory not found: ${targetDir}`);
  process.exit(1);
}

if (selectedLanes.size > 0 && !targetWithinTests) {
  console.error("test-lane: --lane filters are only supported under ./tests");
  process.exit(1);
}

if (targetWithinTests) {
  const { mismatches } = validateTestLaneHeaders(ROOT);
  if (mismatches.length > 0) {
    console.error("test-lane: lane policy violations detected:");
    for (const mismatch of mismatches) {
      console.error(`- ${mismatch}`);
    }
    process.exit(1);
  }
}

let files = collectTestFiles(targetDir);

if (selectedLanes.size > 0) {
  files = files.filter((file) => {
    const lane = parseLaneHeader(fs.readFileSync(file, "utf8"));
    return lane !== undefined && selectedLanes.has(lane);
  });
}

if (files.length === 0) {
  const laneSuffix =
    selectedLanes.size > 0
      ? ` for lanes ${[...selectedLanes].sort().join(", ")}`
      : "";
  console.error(`test-lane: no .test.ts files found under ${targetDir}${laneSuffix}`);
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
