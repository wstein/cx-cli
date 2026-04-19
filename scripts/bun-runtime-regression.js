import path from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { collectTestFiles, validateTestLaneHeaders } from "./test-lane-policy.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TARGET_DIRS = [
  "tests/bundle",
  "tests/cli",
  "tests/mcp",
  "tests/repomix",
];

const extraArgs = process.argv.slice(2);

const { mismatches } = validateTestLaneHeaders(ROOT);
if (mismatches.length > 0) {
  console.error("bun-runtime-regression: lane policy violations detected:");
  for (const mismatch of mismatches) {
    console.error(`- ${mismatch}`);
  }
  process.exit(1);
}

const files = TARGET_DIRS.flatMap((relativeDir) =>
  collectTestFiles(path.join(ROOT, relativeDir)),
).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));

if (files.length === 0) {
  console.error("bun-runtime-regression: no test files found");
  process.exit(1);
}

try {
  await execa("bun", ["test", ...files, ...extraArgs], {
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
