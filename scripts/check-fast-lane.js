import fs from "node:fs";
import path from "node:path";
import {
  ROOT,
  collectTestFiles,
  parseLaneHeader,
} from "./test-lane-policy.js";

const DEFAULT_MAX_FAST_LANE_FILES = 95;

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function parseMaxFastLaneFiles() {
  const rawValue = process.env.FAST_LANE_MAX_FILES;
  if (rawValue === undefined || rawValue.trim() === "") {
    return DEFAULT_MAX_FAST_LANE_FILES;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      `FAST_LANE_MAX_FILES must be a positive integer, got "${rawValue}".`,
    );
  }
  return parsed;
}

function validateFastLaneComposition() {
  const unitDir = path.join(ROOT, "tests", "unit");
  const files = collectTestFiles(unitDir);
  const nonUnitHeaders = [];
  const namingViolations = [];

  for (const fullPath of files) {
    const relativePath = toPosixPath(path.relative(ROOT, fullPath));
    const content = fs.readFileSync(fullPath, "utf8");
    const header = parseLaneHeader(content);

    if (header !== "unit") {
      nonUnitHeaders.push(
        `${relativePath}: expected unit header, found "${header ?? "missing"}"`,
      );
    }

    if (relativePath.includes(".integration.test.ts")) {
      namingViolations.push(
        `${relativePath}: integration naming is not allowed in the fast unit lane`,
      );
    }
  }

  return {
    files,
    nonUnitHeaders,
    namingViolations,
  };
}

try {
  const maxFiles = parseMaxFastLaneFiles();
  const { files, nonUnitHeaders, namingViolations } =
    validateFastLaneComposition();

  if (files.length === 0) {
    console.error("check-fast-lane: no unit test files discovered.");
    process.exit(1);
  }

  if (nonUnitHeaders.length > 0 || namingViolations.length > 0) {
    console.error("check-fast-lane: unit lane composition violations found:");
    for (const violation of [...nonUnitHeaders, ...namingViolations]) {
      console.error(`- ${violation}`);
    }
    process.exit(1);
  }

  if (files.length > maxFiles) {
    console.error(
      `check-fast-lane: ${files.length} files exceed FAST_LANE_MAX_FILES=${maxFiles}.`,
    );
    console.error(
      "Move boundary-heavy coverage out of tests/unit or raise the threshold intentionally.",
    );
    process.exit(1);
  }

  console.log(
    `check-fast-lane: ${files.length} unit files (budget: ${maxFiles})`,
  );
} catch (error) {
  console.error(
    `check-fast-lane: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
