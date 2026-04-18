import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const ALLOWED_LANES = new Set([
  "unit",
  "integration",
  "adversarial",
  "contract",
]);

export const ADVERSARIAL_OVERRIDES = new Set([
  "tests/mcp/server.run.test.ts",
  "tests/repomix/adapter.fallback.test.ts",
]);

export function collectTestFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTestFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

export function expectedLane(relativePath) {
  if (relativePath.startsWith("tests/unit/")) {
    return "unit";
  }
  if (relativePath.startsWith("tests/contracts/")) {
    return "contract";
  }
  if (ADVERSARIAL_OVERRIDES.has(relativePath)) {
    return "adversarial";
  }
  return "integration";
}

export function parseLaneHeader(content) {
  const firstLine = content.split("\n", 1)[0]?.trim();
  if (firstLine === undefined) {
    return undefined;
  }
  const match = firstLine.match(/^\/\/ test-lane:\s*(\S+)$/);
  return match?.[1];
}

export function validateTestLaneHeaders(rootDir = ROOT) {
  const testDir = path.join(rootDir, "tests");
  const files = collectTestFiles(testDir);
  const mismatches = [];

  for (const fullPath of files) {
    const relativePath = path.relative(rootDir, fullPath).split(path.sep).join("/");
    const content = fs.readFileSync(fullPath, "utf8");
    const actualLane = parseLaneHeader(content);
    const expected = expectedLane(relativePath);

    if (actualLane === undefined) {
      mismatches.push(`${relativePath}: missing header (expected "${expected}")`);
      continue;
    }

    if (!ALLOWED_LANES.has(actualLane)) {
      mismatches.push(
        `${relativePath}: invalid lane "${actualLane}" (expected one of ${[
          ...ALLOWED_LANES,
        ].join(", ")})`,
      );
      continue;
    }

    if (actualLane !== expected) {
      mismatches.push(
        `${relativePath}: expected "${expected}" but found "${actualLane}"`,
      );
    }
  }

  return { files, mismatches };
}
