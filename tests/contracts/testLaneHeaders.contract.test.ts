// test-lane: contract
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const ALLOWED_LANES = new Set([
  "unit",
  "integration",
  "adversarial",
  "contract",
]);
const ADVERSARIAL_OVERRIDES = new Set([
  "tests/mcp/server.run.test.ts",
  "tests/repomix/adapter.fallback.test.ts",
]);

function collectTestFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.sort((a, b) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
  );
  const files: string[] = [];

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

function expectedLane(relativePath: string): string {
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

function parseLaneHeader(content: string): string | undefined {
  const firstLine = content.split("\n", 1)[0]?.trim();
  if (firstLine === undefined) {
    return undefined;
  }
  const match = firstLine.match(/^\/\/ test-lane:\s*(\S+)$/);
  return match?.[1];
}

describe("test lane headers", () => {
  test("all test files declare and match their lane headers", () => {
    const testDir = path.join(ROOT, "tests");
    const files = collectTestFiles(testDir);

    const mismatches: string[] = [];

    for (const fullPath of files) {
      const relativePath = path
        .relative(ROOT, fullPath)
        .split(path.sep)
        .join("/");
      const content = fs.readFileSync(fullPath, "utf8");
      const actualLane = parseLaneHeader(content);
      const expected = expectedLane(relativePath);

      if (actualLane === undefined) {
        mismatches.push(
          `${relativePath}: missing header (expected "${expected}")`,
        );
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

    expect(mismatches).toEqual([]);
  });
});
