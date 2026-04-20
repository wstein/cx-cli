// test-lane: contract

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const UNIT_ROOT = path.join(ROOT, "tests/unit");
const FORBIDDEN_IMPORT_MARKERS = [
  "scripts/build-antora-site.js",
  "scripts/assemble-pages-site.js",
  "scripts/check-pages-site.js",
];

async function collectUnitTests(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return collectUnitTests(fullPath);
      }
      return entry.isFile() && entry.name.endsWith(".test.ts")
        ? [fullPath]
        : [];
    }),
  );
  return nested.flat().sort();
}

describe("unit lane build boundary contract", () => {
  test("unit tests do not import real docs/pages build scripts", async () => {
    const files = await collectUnitTests(UNIT_ROOT);
    const violations: string[] = [];

    for (const file of files) {
      const contents = await fs.readFile(file, "utf8");
      for (const marker of FORBIDDEN_IMPORT_MARKERS) {
        if (contents.includes(marker)) {
          violations.push(`${path.relative(ROOT, file)} imports ${marker}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
